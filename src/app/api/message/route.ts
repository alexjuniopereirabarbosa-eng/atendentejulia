import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { openai, isOpenAIConfigured } from '@/lib/openai';
import { buildSystemPrompt } from '@/lib/prompts';
import type { Conversation } from '@/lib/conversation-logic';

// ajuste para sua mídia real
const DEMO_IMAGE_URL = process.env.JULIA_DEMO_IMAGE_URL || 'https://i.ibb.co/jZ1d1Pcs/quero-mais-cenarios-202604061731.jpg';

// convites de prévia que o sistema pode reconhecer no histórico recente
const PREVIEW_INVITES = [
  'tem uma coisa que eu fiz hoje… fiquei até com vergonha 🙈 posso te mostrar?',
  'quer ver uma prévia',
  'tenho uma prévia',
  'posso te mostrar uma foto',
  'foto de demonstração',
];

// respostas positivas
const POSITIVE_REPLY_REGEX =
  /^(sim|claro|quero|pode|manda|mostra|quero ver|pode mandar|ok|okay|beleza)$/i;

const FALLBACK_RESPONSES = [
  'Oi… não sei porque, mas você me chamou atenção.',
  'Me conta uma coisa… você é sempre assim mais tranquilo?',
  'Tô gostando de falar com você… tem algo diferente.',
  'Tem uma coisa aqui que eu quase não mostro… quer ver?',
  'Se eu te mostrar, você promete não sumir depois? 😅',
  'Posso te mostrar um detalhe agora… mas é só um pedacinho.',
  'Se fizer sentido pra você, te explico melhor como funciona.',
  'Não vai desaparecer agora né… fiquei curiosa com você.',
];

function normalizeText(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase();
}

function isPositiveReply(text: string): boolean {
  return POSITIVE_REPLY_REGEX.test(text.trim());
}

function assistantRecentlyOfferedPreview(
  recentMessages: Array<{ sender: string; content: string | null }>
): boolean {
  const lastAssistantText = [...recentMessages]
    .reverse()
    .find((m) => m.sender === 'assistant' && m.content)?.content;

  const normalized = normalizeText(lastAssistantText);
  return PREVIEW_INVITES.some((invite) => normalized.includes(invite));
}

export async function POST(req: NextRequest) {
  try {
    const { conversationId, content } = await req.json();

    if (!conversationId || !content) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    const sanitizedContent = content
      .trim()
      .slice(0, 1000)
      .replace(/<[^>]*>/g, '');

    if (!sanitizedContent) {
      return NextResponse.json({ error: 'Mensagem inválida' }, { status: 400 });
    }

    const { data: conversation, error: convError } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 });
    }

    const conv = conversation as Conversation;

    if (conv.status === 'blocked_free_limit' || conv.status === 'blocked_paid_limit') {
      return NextResponse.json({ error: 'LIMIT_REACHED' }, { status: 403 });
    }

    const { data: userMessage, error: userMsgError } = await supabaseAdmin
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender: 'user',
        content: sanitizedContent,
        message_type: 'text',
      })
      .select()
      .single();

    if (userMsgError) {
      console.error('Error saving user message:', userMsgError);
      return NextResponse.json({ error: 'Erro ao salvar mensagem' }, { status: 500 });
    }

    const { data: recentMessages } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .neq('message_type', 'system')
      .order('created_at', { ascending: false })
      .limit(20);

    const orderedMessages = (recentMessages || []).reverse();

    const contextMessages = orderedMessages.map((m) => ({
      role: m.sender === 'user' ? ('user' as const) : ('assistant' as const),
      content: m.content || '',
    }));

    const { data: promptSetting } = await supabaseAdmin
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'assistant_prompt')
      .single();

    const systemPrompt = buildSystemPrompt(conv, promptSetting?.setting_value || null);

    const freeUsed = conv.free_used || 0;
    const paidRemaining = conv.paid_remaining || 0;

    let isLast = false;
    if (conv.status === 'active_free' && freeUsed >= 14) {
      isLast = true;
    } else if (conv.status === 'active_paid' && paidRemaining === 1) {
      isLast = true;
    }

    let finalSystemPrompt = systemPrompt;
    if (isLast) {
      finalSystemPrompt +=
        '\n\nESTA É SUA ÚLTIMA MENSAGEM DESTE CICLO. Despeça-se com carinho e de forma profissional.';
    }

    // Regra técnica: se a assistente acabou de oferecer uma prévia e o usuário respondeu positivamente,
    // enviar a imagem diretamente sem depender do modelo para essa decisão.
    const shouldSendPreviewImage =
      isPositiveReply(sanitizedContent) &&
      assistantRecentlyOfferedPreview(orderedMessages) &&
      (conv.current_cycle_images_sent || 0) < 2;

    let assistantContent: string;

    if (shouldSendPreviewImage) {
      assistantContent = 'Então olha essa prévia aqui 👀';
    } else if (isOpenAIConfigured()) {
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'system', content: finalSystemPrompt }, ...contextMessages],
          max_tokens: 150,
          temperature: 0.85,
        });

        assistantContent =
          completion.choices[0]?.message?.content || 'Olá! Posso te ajudar com mais detalhes?';
      } catch (aiError) {
        console.error('[Julia] OpenAI error:', aiError);
        assistantContent =
          FALLBACK_RESPONSES[Math.floor(Math.random() * FALLBACK_RESPONSES.length)];
      }
    } else {
      console.warn('[Julia] OpenAI não configurada — usando resposta fallback');
      assistantContent = isLast
        ? 'Vou encerrar por agora. Se quiser, depois continuamos.'
        : FALLBACK_RESPONSES[freeUsed % FALLBACK_RESPONSES.length];
    }

    const { data: assistantMessage, error: assistantMsgError } = await supabaseAdmin
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender: 'assistant',
        content: assistantContent,
        message_type: 'text',
      })
      .select()
      .single();

    if (assistantMsgError) {
      console.error('Error saving assistant message:', assistantMsgError);
      return NextResponse.json({ error: 'Erro ao salvar resposta' }, { status: 500 });
    }

    let imageMessage = null;
    let followupMessage = null;
    let newImageCount = conv.current_cycle_images_sent || 0;

    if (shouldSendPreviewImage) {
      const { data: insertedImage, error: imageError } = await supabaseAdmin
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender: 'assistant',
          content: null,
          message_type: 'image',
          image_url: DEMO_IMAGE_URL,
        })
        .select()
        .single();

      if (imageError) {
        console.error('Error saving image message:', imageError);
        return NextResponse.json({ error: 'Erro ao salvar imagem' }, { status: 500 });
      }

      imageMessage = insertedImage;
      newImageCount += 1;

      const { data: insertedFollowup, error: followupError } = await supabaseAdmin
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender: 'assistant',
          content: 'Quero saber o que você achou dessa prévia.',
          message_type: 'text',
        })
        .select()
        .single();

      if (followupError) {
        console.error('Error saving followup message:', followupError);
        return NextResponse.json({ error: 'Erro ao salvar continuação' }, { status: 500 });
      }

      followupMessage = insertedFollowup;
    }

    let updatedFreeUsed = freeUsed;
    let updatedPaidRemaining = paidRemaining;
    const rawStatus =
      conv.status === 'active'
        ? 'active_free'
        : conv.status === 'paid'
        ? 'active_paid'
        : conv.status || 'active_free';

    let updatedStatus = rawStatus as
      | 'active_free'
      | 'active_paid'
      | 'blocked_free_limit'
      | 'blocked_paid_limit';

    if (updatedStatus === 'active_free') {
      updatedFreeUsed += 1;
      if (updatedFreeUsed >= 15) {
        updatedStatus = 'blocked_free_limit';
      }
    } else if (updatedStatus === 'active_paid') {
      updatedPaidRemaining = Math.max(0, updatedPaidRemaining - 1);
      if (updatedPaidRemaining <= 0) {
        updatedStatus = 'blocked_paid_limit';
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from('conversations')
      .update({
        free_used: updatedFreeUsed,
        paid_remaining: updatedPaidRemaining,
        current_cycle_images_sent: newImageCount,
        status: updatedStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId);

    if (updateError) {
      console.error('Error updating counters:', updateError);
    }

    const previousStatusNormalized =
      conv.status === 'active'
        ? 'active_free'
        : conv.status === 'paid'
        ? 'active_paid'
        : ((conv.status || 'active_free') as
            | 'active_free'
            | 'active_paid'
            | 'blocked_free_limit'
            | 'blocked_paid_limit');

    if (
      (updatedStatus === 'blocked_free_limit' &&
        previousStatusNormalized !== 'blocked_free_limit') ||
      (updatedStatus === 'blocked_paid_limit' &&
        previousStatusNormalized !== 'blocked_paid_limit')
    ) {
      await supabaseAdmin.from('messages').insert({
        conversation_id: conversationId,
        sender: 'system',
        content:
          updatedStatus === 'blocked_free_limit'
            ? 'Suas mensagens gratuitas terminaram. Libere mais mensagens para continuar.'
            : 'O ciclo de mensagens pagas terminou. Libere mais mensagens para continuar.',
        message_type: 'system',
      });
    }

    return NextResponse.json({
      userMessage,
      assistantMessage,
      imageMessage,
      followupMessage,
      conversation: {
        ...conv,
        free_used: updatedFreeUsed,
        paid_remaining: updatedPaidRemaining,
        current_cycle_images_sent: newImageCount,
        status: updatedStatus,
      },
    });
  } catch (err) {
    console.error('Message API error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
