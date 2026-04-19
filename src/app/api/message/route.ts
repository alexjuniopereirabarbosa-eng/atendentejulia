import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { openai, isOpenAIConfigured } from '@/lib/openai';
import { buildSystemPrompt } from '@/lib/prompts';
import type { Conversation } from '@/lib/conversation-logic';

// ajuste para sua mídia real
const DEMO_IMAGE_URL =
  process.env.JULIA_DEMO_IMAGE_URL ||
  'https://i.ibb.co/jZ1d1Pcs/quero-mais-cenarios-202604061731.jpg';

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

    // Buscar conversa
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

    // Salvar mensagem do usuário
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

    // Buscar histórico recente (inclui a mensagem do usuário que acabou de ser salva)
    const { data: recentMessages } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .neq('message_type', 'system')
      .order('created_at', { ascending: false })
      .limit(20);

    const orderedMessages = (recentMessages || []).reverse();

    // Montar contexto para a OpenAI — filtra mensagens sem conteúdo (imagens, etc.)
    const contextMessages = orderedMessages
      .filter((m) => m.content && m.content.trim() !== '')
      .map((m) => ({
        role: m.sender === 'user' ? ('user' as const) : ('assistant' as const),
        content: m.content as string,
      }));

    // Buscar prompt customizado do admin
    const { data: promptSetting } = await supabaseAdmin
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'assistant_prompt')
      .single();

    const systemPrompt = buildSystemPrompt(conv, promptSetting?.setting_value || null);

    const freeUsed = conv.free_used || 0;
    const paidRemaining = conv.paid_remaining || 0;

    // Detectar se é a última mensagem do ciclo
    let isLast = false;
    if (
      (conv.status === 'active' || conv.status === 'active_free') &&
      freeUsed >= 14
    ) {
      isLast = true;
    } else if (
      (conv.status === 'paid' || conv.status === 'active_paid') &&
      paidRemaining === 1
    ) {
      isLast = true;
    }

    let finalSystemPrompt = systemPrompt;
    if (isLast) {
      finalSystemPrompt +=
        '\n\nESTA É SUA ÚLTIMA MENSAGEM DESTE CICLO. Despeça-se com carinho e de forma profissional.';
    }

    // Regra técnica: enviar prévia de imagem se o usuário respondeu positivamente a um convite
    const shouldSendPreviewImage =
      isPositiveReply(sanitizedContent) &&
      assistantRecentlyOfferedPreview(orderedMessages) &&
      (conv.current_cycle_images_sent || 0) < 2;

    // ── Gerar resposta da assistente ──────────────────────────────────────────
    let assistantContent: string;

    if (shouldSendPreviewImage) {
      assistantContent = 'Então olha essa prévia aqui 👀';
    } else if (isOpenAIConfigured()) {
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: finalSystemPrompt },
            ...contextMessages,
          ],
          max_tokens: 150,
          temperature: 0.85,
        });

        assistantContent =
          completion.choices[0]?.message?.content?.trim() ||
          'Olá! Pode me contar mais?';
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

    // Salvar resposta da assistente
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

    // ── Imagem de prévia (se aplicável) ──────────────────────────────────────
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
      } else {
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

        if (!followupError) {
          followupMessage = insertedFollowup;
        }
      }
    }

    // ── Atualizar contadores da conversa ──────────────────────────────────────
    let updatedFreeUsed = freeUsed;
    let updatedPaidRemaining = paidRemaining;
    let updatedStatus: Conversation['status'] = conv.status;

    if (conv.status === 'active' || conv.status === 'active_free') {
      updatedFreeUsed = freeUsed + 1;
      if (updatedFreeUsed >= 15) {
        updatedStatus = 'blocked_free_limit';
      }
    } else if (conv.status === 'paid' || conv.status === 'active_paid') {
      updatedPaidRemaining = Math.max(0, paidRemaining - 1);
      if (updatedPaidRemaining <= 0) {
        updatedStatus = 'blocked_paid_limit';
      }
    }

    const { data: updatedConv, error: updateError } = await supabaseAdmin
      .from('conversations')
      .update({
        free_used: updatedFreeUsed,
        paid_remaining: updatedPaidRemaining,
        status: updatedStatus,
        current_cycle_images_sent: newImageCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating conversation:', updateError);
    }

    // ── Retornar para o front ─────────────────────────────────────────────────
    return NextResponse.json({
      userMessage,
      assistantMessage,
      imageMessage,
      followupMessage,
      conversation: updatedConv || {
        ...conv,
        free_used: updatedFreeUsed,
        paid_remaining: updatedPaidRemaining,
        status: updatedStatus,
        current_cycle_images_sent: newImageCount,
      },
    });
  } catch (err) {
    console.error('[Julia] Erro geral na rota /api/message:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
