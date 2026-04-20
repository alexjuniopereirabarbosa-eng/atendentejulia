import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { isOpenAIConfigured } from '@/lib/openai';
import { buildSystemPrompt } from '@/lib/prompts';
import type { Conversation } from '@/lib/conversation-logic';

const DEMO_IMAGE_URL =
  process.env.JULIA_DEMO_IMAGE_URL ||
  'https://i.ibb.co/jZ1d1Pcs/quero-mais-cenarios-202604061731.jpg';

const POSITIVE_REPLY_REGEX =
  /^(sim|claro|quero|pode|manda|mostra|quero ver|pode mandar|ok|okay|beleza)$/i;

const FALLBACK_RESPONSES = [
  'Que bom falar com voce, me conta mais.',
  'Voce me deixou curiosa com isso.',
  'To gostando dessa conversa.',
  'Me conta mais sobre voce.',
  'Interessante, e ai, como ta sendo seu dia?',
  'Boa pergunta. Me conta, o que voce acha?',
  'Gosto de conversar com voce.',
  'Pode falar, to te ouvindo.',
];

function isPositiveReply(text: string): boolean {
  return POSITIVE_REPLY_REGEX.test(text.trim());
}

function assistantRecentlyOfferedPreview(
  recentMessages: Array<{ sender: string; content: string | null }>
): boolean {
  const lastAssistantText = [...recentMessages]
    .reverse()
    .find((m) => m.sender === 'assistant' && m.content)?.content;
  const normalized = (lastAssistantText || '').toLowerCase();
  return ['quer ver uma previa', 'tenho uma previa', 'posso te mostrar'].some(
    (kw) => normalized.includes(kw)
  );
}

export async function POST(req: NextRequest) {
  try {
    const { conversationId, content } = await req.json();

    if (!conversationId || !content) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    const sanitizedContent = content.trim().slice(0, 1000).replace(/<[^>]*>/g, '');
    if (!sanitizedContent) {
      return NextResponse.json({ error: 'Mensagem invalida' }, { status: 400 });
    }

    const db = getSupabaseAdmin();

    const { data: conversation, error: convError } = await db
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversa nao encontrada' }, { status: 404 });
    }

    const conv = conversation as Conversation;

    if (conv.status === 'blocked_free_limit' || conv.status === 'blocked_paid_limit') {
      return NextResponse.json({ error: 'LIMIT_REACHED' }, { status: 403 });
    }

    // Salvar mensagem do usuario
    const { data: userMessage, error: userMsgError } = await db
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

    // Buscar historico recente
    const { data: recentMessages } = await db
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .neq('message_type', 'system')
      .order('created_at', { ascending: false })
      .limit(20);

    const orderedMessages = (recentMessages || []).reverse();

    const contextMessages = orderedMessages
      .filter((m) => m.content && m.content.trim() !== '')
      .map((m) => ({
        role: m.sender === 'user' ? ('user' as const) : ('assistant' as const),
        content: m.content as string,
      }));

    // Buscar prompt customizado
    const { data: promptSetting } = await db
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'assistant_prompt')
      .single();

    const systemPrompt = buildSystemPrompt(conv, promptSetting?.setting_value || null);
    const freeUsed = conv.free_used || 0;
    const paidRemaining = conv.paid_remaining || 0;

    let isLast = false;
    if ((conv.status === 'active' || conv.status === 'active_free') && freeUsed >= 14) {
      isLast = true;
    } else if ((conv.status === 'paid' || conv.status === 'active_paid') && paidRemaining === 1) {
      isLast = true;
    }

    let finalSystemPrompt = systemPrompt;
    if (isLast) {
      finalSystemPrompt += '\n\nESTA EH SUA ULTIMA MENSAGEM DESTE CICLO. Despeca-se com carinho.';
    }

    const imagesThisCycle = (conv as unknown as Record<string, number>).current_cycle_images_sent || 0;
    const shouldSendPreviewImage =
      isPositiveReply(sanitizedContent) &&
      assistantRecentlyOfferedPreview(orderedMessages) &&
      imagesThisCycle < 2;

    // Gerar resposta
    let assistantContent: string;

    if (shouldSendPreviewImage) {
      assistantContent = 'Entao olha essa previa aqui';
    } else if (isOpenAIConfigured()) {
      try {
        const openaiKey = process.env.OPENAI_API_KEY!;
        const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + openaiKey,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: finalSystemPrompt },
              ...contextMessages,
            ],
            max_tokens: 150,
            temperature: 0.85,
          }),
        });
        if (!aiRes.ok) {
          throw new Error('OpenAI HTTP ' + aiRes.status);
        }
        const aiJson = await aiRes.json() as { choices: Array<{ message: { content: string | null } }> };
        assistantContent = aiJson.choices[0]?.message?.content?.trim() || 'Ola! Pode me contar mais?';
      } catch (aiError) {
        console.error('[Julia] OpenAI error:', aiError);
        assistantContent = FALLBACK_RESPONSES[Math.floor(Math.random() * FALLBACK_RESPONSES.length)];
      }
    } else {
      console.warn('[Julia] OpenAI nao configurada');
      assistantContent = isLast
        ? 'Vou encerrar por agora. Se quiser, depois continuamos.'
        : FALLBACK_RESPONSES[freeUsed % FALLBACK_RESPONSES.length];
    }

    // Salvar resposta da assistente
    const { data: assistantMessage, error: assistantMsgError } = await db
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

    // Atualizar contadores
    let updatedFreeUsed = freeUsed;
    let updatedPaidRemaining = paidRemaining;
    let updatedStatus: string = conv.status;

    if (conv.status === 'active' || conv.status === 'active_free') {
      updatedFreeUsed = freeUsed + 1;
      if (updatedFreeUsed >= 15) updatedStatus = 'blocked_free_limit';
    } else if (conv.status === 'paid' || conv.status === 'active_paid') {
      updatedPaidRemaining = Math.max(0, paidRemaining - 1);
      if (updatedPaidRemaining <= 0) updatedStatus = 'blocked_paid_limit';
    }

    const { data: updatedConv } = await db
      .from('conversations')
      .update({
        free_used: updatedFreeUsed,
        paid_remaining: updatedPaidRemaining,
        status: updatedStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)
      .select()
      .single();

    return NextResponse.json({
      userMessage,
      assistantMessage,
      imageMessage: null,
      followupMessage: null,
      conversation: updatedConv || {
        ...conv,
        free_used: updatedFreeUsed,
        paid_remaining: updatedPaidRemaining,
        status: updatedStatus,
      },
    });
  } catch (err) {
    console.error('[Julia] Erro geral:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
