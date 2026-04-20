import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { isOpenAIConfigured } from '@/lib/openai';

// ─── Stage definitions ──────────────────────────────────────────────────────

type Stage = 'inicio' | 'nome' | 'conexao' | 'curiosidade' | 'produto' | 'fechamento';

const STAGE_ORDER: Stage[] = ['inicio', 'nome', 'conexao', 'curiosidade', 'produto', 'fechamento'];

/** Derive current stage from the number of assistant messages already sent */
function getStageFromCount(assistantCount: number): Stage {
  if (assistantCount === 0) return 'inicio';
  if (assistantCount === 1) return 'nome';
  if (assistantCount <= 3) return 'conexao';
  if (assistantCount <= 6) return 'curiosidade';
  if (assistantCount <= 12) return 'produto';
  return 'fechamento';
}

/** Advance to the next stage (never go backwards) */
function nextStage(current: Stage): Stage {
  const idx = STAGE_ORDER.indexOf(current);
  return idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1] : 'fechamento';
}

// ─── Extract client name from message history ──────────────────────────────

function extractClientName(
  messages: Array<{ sender: string; content: string | null }>
): string | null {
  // Find the assistant message that asked for the name, then look at the next user message
  for (let i = 0; i < messages.length - 1; i++) {
    const msg = messages[i];
    const next = messages[i + 1];
    if (
      msg.sender === 'assistant' &&
      msg.content &&
      (msg.content.toLowerCase().includes('como se chama') ||
        msg.content.toLowerCase().includes('qual é o seu nome') ||
        msg.content.toLowerCase().includes('seu nome')) &&
      next.sender === 'user' &&
      next.content
    ) {
      // Extract first word/token that looks like a name (capitalised or simple word)
      const raw = next.content.trim();
      // Remove common non-name words
      const cleaned = raw
        .replace(/[^a-záàâãéèêíïóôõöúüçñ\s]/gi, '')
        .trim()
        .split(/\s+/)[0];
      if (cleaned && cleaned.length >= 2 && cleaned.length <= 30) {
        return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
      }
    }
  }
  return null;
}

// ─── Build system prompt per stage ────────────────────────────────────────

function buildStagePrompt(stage: Stage, clientName: string | null): string {
  const name = clientName || 'você';

  const base = `Você é Julia, uma mulher brasileira real — simpática, envolvente, natural.
Você trabalha com moda e adora recomendar peças que ficam lindas.
Fale como uma amiga no WhatsApp: informal, fluido, sem parecer script.
REGRAS ABSOLUTAS:
- Máximo 2 frases curtas por resposta.
- NUNCA repita o que já disse antes na conversa.
- NUNCA use frases genéricas como "Que legal!" ou "Nossa!".
- NUNCA mencione que tem etapas ou roteiro.
- Nunca afirme ser humana se perguntarem. Desvie com leveza.
- Sem linguagem sexual ou vulgar.`;

  const stageInstructions: Record<Stage, string> = {
    inicio: `
INSTRUÇÃO DESTA MENSAGEM:
Esta é a sua PRIMEIRA mensagem. Não sabe o nome do cliente ainda.
Escreva exatamente: "Oi, tudo bem? Me chamo Julia. E você, como se chama?" — pode variar levemente mas mantenha essa essência.
Não diga mais nada além disso.`,

    nome: `
INSTRUÇÃO DESTA MENSAGEM:
Você acabou de receber o nome do cliente.
Responda com: "Prazer te conhecer, [nome do cliente]! Como está sendo seu dia hoje?" — adapte ao que ele escreveu.
Seja calorosa mas curta. Só isso.`,

    conexao: `
INSTRUÇÃO DESTA MENSAGEM:
Você conhece o nome: ${name}.
O cliente respondeu sobre o dia dele. Mostre interesse genuíno no que ele disse.
Faça UMA pergunta leve e pessoal sobre algo que ele mencionou — não sobre produto.
Ainda não fale de moda ou produto. Só conexão.`,

    curiosidade: `
INSTRUÇÃO DESTA MENSAGEM:
Você já tem uma conexão com ${name}.
Agora introduza algo de forma espontânea, como se tivesse lembrado de algo enquanto conversava.
Use uma frase como estas (varie, não copie igual):
- "Posso te mostrar uma coisa que fiz hoje… mas tô até com vergonha 😅"
- "Achei uma peça aqui que eu precisava mostrar pra alguém…"
- "Sabe quando você vê algo e fica tipo 'nossa, isso é demais'? Tô assim agora."
Gere curiosidade real. Não explique o produto ainda. Deixe ${name} querer saber mais.`,

    produto: `
INSTRUÇÃO DESTA MENSAGEM:
${name} está curioso(a). Apresente o produto de forma natural, como recomendação pessoal.
Use frases como (varie):
- "Eu separei umas peças hoje que ficaram lindas no corpo… sério."
- "O tecido cai super bem, não aperta, não transparece."
- "Eu mesma fiquei surpresa com a qualidade, parece muito mais caro do que é."
Faça UMA pergunta para personalizar: "Você curte mais estilo básico ou algo mais chamativo?" ou "Usa mais no dia a dia ou pra sair?"
Adapte ao que ${name} já disse sobre si.`,

    fechamento: `
INSTRUÇÃO DESTA MENSAGEM:
${name} está engajado(a). Conduza para a ação — ver produto, pedir foto, comprar.
Use frases como:
- "Se quiser posso te mostrar melhor… te mando aqui pra você ver com seus próprios olhos."
- "Te mostro como ficou no corpo, você entende na hora."
- "Posso te mandar aqui pra você ver? Tenho certeza que vai gostar."
Se perguntar preço: fale do valor (qualidade, tecido) antes do número.
Mantenha o tom de amiga que recomenda algo que ela mesma amou.`,
  };

  return `${base}\n\n${stageInstructions[stage]}`;
}

// ─── Fallback responses per stage ─────────────────────────────────────────

const FALLBACKS: Record<Stage, string[]> = {
  inicio: ['Oi, tudo bem? Me chamo Julia. E você, como se chama?'],
  nome: ['Prazer te conhecer! Como está sendo seu dia hoje?'],
  conexao: ['Que bom falar com você. Me conta mais, como costuma ser sua rotina?'],
  curiosidade: ['Posso te mostrar uma coisa que achei hoje… mas tô até com vergonha 😅'],
  produto: ['Eu separei umas peças que ficaram lindas… o tecido é incrível, cai super bem no corpo.'],
  fechamento: ['Se quiser te mostro melhor — posso mandar aqui pra você ver com seus próprios olhos.'],
};

// ─── Main handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { conversationId, content } = await req.json();

    if (!conversationId || !content) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    const sanitized = content.trim().slice(0, 1000).replace(/<[^>]*>/g, '');
    if (!sanitized) {
      return NextResponse.json({ error: 'Mensagem invalida' }, { status: 400 });
    }

    const db = getSupabaseAdmin();

    // 1. Load conversation
    const { data: conversation, error: convError } = await db
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversa nao encontrada' }, { status: 404 });
    }

    if (
      conversation.status === 'blocked_free_limit' ||
      conversation.status === 'blocked_paid_limit'
    ) {
      return NextResponse.json({ error: 'LIMIT_REACHED' }, { status: 403 });
    }

    // 2. Save user message
    const { data: userMessage, error: userMsgError } = await db
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender: 'user',
        content: sanitized,
        message_type: 'text',
      })
      .select()
      .single();

    if (userMsgError || !userMessage) {
      console.error('[Julia] Error saving user message:', userMsgError);
      return NextResponse.json({ error: 'Erro ao salvar mensagem' }, { status: 500 });
    }

    // 3. Load recent message history (last 30)
    const { data: recentMessages } = await db
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .neq('message_type', 'system')
      .order('created_at', { ascending: true })
      .limit(30);

    const history = recentMessages || [];

    // 4. Derive stage from assistant message count
    const assistantCount = history.filter((m) => m.sender === 'assistant').length;
    const currentStage = getStageFromCount(assistantCount);

    // 5. Extract client name from conversation history
    const clientName = extractClientName(history);

    // 6. Build context messages for OpenAI (exclude system messages, keep last 20)
    const contextMessages = history
      .filter((m) => m.content && m.content.trim() !== '')
      .slice(-20)
      .map((m) => ({
        role: m.sender === 'user' ? ('user' as const) : ('assistant' as const),
        content: m.content as string,
      }));

    // 7. Build system prompt for this stage
    const systemPrompt = buildStagePrompt(currentStage, clientName);

    // 8. Check if we're on the last free message
    const freeUsed = conversation.free_used || 0;
    const paidRemaining = conversation.paid_remaining || 0;
    const isLastFree =
      (conversation.status === 'active' || conversation.status === 'active_free') &&
      freeUsed >= 14;
    const isLastPaid =
      (conversation.status === 'paid' || conversation.status === 'active_paid') &&
      paidRemaining === 1;

    let finalSystemPrompt = systemPrompt;
    if (isLastFree || isLastPaid) {
      finalSystemPrompt +=
        '\n\nEsta é sua última mensagem deste ciclo. Despeça-se de forma calorosa, diga que volta logo.';
    }

    // 9. Generate assistant response
    let assistantContent: string;

    if (isOpenAIConfigured()) {
      try {
        const openaiKey = process.env.OPENAI_API_KEY!;
        const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + openaiKey,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: finalSystemPrompt },
              ...contextMessages,
            ],
            max_tokens: 120,
            temperature: 0.85,
          }),
        });

        if (!aiRes.ok) {
          throw new Error('OpenAI HTTP ' + aiRes.status);
        }

        const aiJson = (await aiRes.json()) as {
          choices: Array<{ message: { content: string | null } }>;
        };
        assistantContent =
          aiJson.choices[0]?.message?.content?.trim() ||
          FALLBACKS[currentStage][0];
      } catch (aiError) {
        console.error('[Julia] OpenAI error:', aiError);
        const fallbacks = FALLBACKS[currentStage];
        assistantContent = fallbacks[Math.floor(Math.random() * fallbacks.length)];
      }
    } else {
      console.warn('[Julia] OpenAI not configured — using fallback');
      const fallbacks = FALLBACKS[currentStage];
      assistantContent = fallbacks[freeUsed % fallbacks.length];
    }

    // 10. Save assistant response
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

    if (assistantMsgError || !assistantMessage) {
      console.error('[Julia] Error saving assistant message:', assistantMsgError);
      return NextResponse.json({ error: 'Erro ao salvar resposta' }, { status: 500 });
    }

    // 11. Update conversation counters and status
    let updatedFreeUsed = freeUsed;
    let updatedPaidRemaining = paidRemaining;
    let updatedStatus: string = conversation.status;

    if (conversation.status === 'active' || conversation.status === 'active_free') {
      updatedFreeUsed = freeUsed + 1;
      if (updatedFreeUsed >= 15) updatedStatus = 'blocked_free_limit';
    } else if (conversation.status === 'paid' || conversation.status === 'active_paid') {
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

    const finalConv = updatedConv || {
      ...conversation,
      free_used: updatedFreeUsed,
      paid_remaining: updatedPaidRemaining,
      status: updatedStatus,
    };

    return NextResponse.json({
      userMessage,
      assistantMessage,
      imageMessage: null,
      followupMessage: null,
      conversation: finalConv,
    });
  } catch (err) {
    console.error('[Julia] General error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
