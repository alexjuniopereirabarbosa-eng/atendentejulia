import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { openai, isOpenAIConfigured } from '@/lib/openai';
import { buildSystemPrompt } from '@/lib/prompts';
import type { Conversation } from '@/lib/conversation-logic';

// Fallback responses when OpenAI is not configured
const FALLBACK_RESPONSES = [
  'Oi, meu amor! Gostei de te ver por aqui. 💕',
  'Me conta, como foi seu dia? 😊',
  'Estou gostando de falar com você.',
  'Você parece ser uma pessoa muito especial.',
  'Nossa conversa está ficando boa! 😘',
  'Que bom que você está aqui comigo.',
  'Você me deixa curiosa... me conta mais!',
  'Adoro conversar com você, sabia?',
  'Você tem um jeitinho que me encanta.',
  'Me fala mais sobre você, lindo!',
];

export async function POST(req: NextRequest) {
  try {
    const { conversationId, content } = await req.json();

    if (!conversationId || !content) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    // Sanitize input
    const sanitizedContent = content
      .trim()
      .slice(0, 1000) // Max 1000 chars
      .replace(/<[^>]*>/g, ''); // Strip HTML

    if (!sanitizedContent) {
      return NextResponse.json({ error: 'Mensagem inválida' }, { status: 400 });
    }

    // 1. Get conversation
    const { data: conversation, error: convError } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 });
    }

    const conv = conversation as Conversation;

    // 2. Check if can respond
    if (conv.status === 'blocked_free_limit' || conv.status === 'blocked_paid_limit') {
      return NextResponse.json(
        { error: 'LIMIT_REACHED' },
        { status: 403 }
      );
    }

    // 3. Save user message
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

    // 4. Build context (last 20 messages)
    const { data: recentMessages } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .neq('message_type', 'system')
      .order('created_at', { ascending: false })
      .limit(20);

    const contextMessages = (recentMessages || [])
      .reverse()
      .map((m) => ({
        role: m.sender === 'user' ? 'user' as const : 'assistant' as const,
        content: m.content || '',
      }));

    // 5. Get custom prompt from admin settings if available
    const { data: promptSetting } = await supabaseAdmin
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'assistant_prompt')
      .single();

    // 6. Build system prompt
    const systemPrompt = buildSystemPrompt(
      conv,
      promptSetting?.setting_value || null
    );

    // 7. Check if this is the last paid/free message
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
      finalSystemPrompt += '\n\nESTA É SUA ÚLTIMA MENSAGEM DESTE CICLO. Despeca-se com carinho: "Vou ter que sair um pouquinho agora, meu amor. Depois volto para falar com você. 💋"';
    }

    // 8. Call OpenAI (or use fallback)
    let assistantContent: string;

    if (isOpenAIConfigured()) {
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
        assistantContent = completion.choices[0]?.message?.content || 'Oi, meu amor! 💕';
      } catch (aiError) {
        console.error('[Julia] OpenAI error:', aiError);
        assistantContent = FALLBACK_RESPONSES[Math.floor(Math.random() * FALLBACK_RESPONSES.length)];
      }
    } else {
      // Fallback when OpenAI is not configured
      console.warn('[Julia] OpenAI não configurada — usando resposta fallback');
      if (isLast) {
        assistantContent = 'Vou ter que sair um pouquinho agora, meu amor. Depois volto para falar com você. 💋';
      } else {
        assistantContent = FALLBACK_RESPONSES[freeUsed % FALLBACK_RESPONSES.length];
      }
    }

    // 9. Save assistant message
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

    // 10. Update counters
    let updatedFreeUsed = freeUsed;
    let updatedPaidRemaining = paidRemaining;
    const rawStatus = conv.status === 'active' ? 'active_free' : conv.status === 'paid' ? 'active_paid' : conv.status || 'active_free';
    let updatedStatus: 'active_free' | 'active_paid' | 'blocked_free_limit' | 'blocked_paid_limit' = rawStatus as 'active_free' | 'active_paid' | 'blocked_free_limit' | 'blocked_paid_limit';

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
        status: updatedStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId);

    if (updateError) {
      console.error('Error updating counters:', updateError);
    }

    // 11. If just blocked, add system message
    if (
      (updatedStatus === 'blocked_free_limit' && conv.status !== 'blocked_free_limit') ||
      (updatedStatus === 'blocked_paid_limit' && conv.status !== 'blocked_paid_limit')
    ) {
      await supabaseAdmin.from('messages').insert({
        conversation_id: conversationId,
        sender: 'system',
        content:
          updatedStatus === 'blocked_free_limit'
            ? 'Suas mensagens gratuitas terminaram. Libere mais mensagens para continuar conversando com Julia.'
            : 'O ciclo de mensagens pagas terminou. Libere mais mensagens para continuar.',
        message_type: 'system',
      });
    }

    return NextResponse.json({
      userMessage,
      assistantMessage,
      conversation: {
        ...conv,
        free_used: updatedFreeUsed,
        paid_remaining: updatedPaidRemaining,
        status: updatedStatus,
      },
    });
  } catch (err) {
    console.error('Message API error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
