import { NextRequest, NextResponse } from 'next/server';

// ─── Types ─────────────────────────────────────────────────────────────────

type Stage = 'inicio' | 'nome' | 'conexao' | 'curiosidade' | 'continuidade';

interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ─── Stage derivation ──────────────────────────────────────────────────────

/**
 * Derive the current conversation stage from the in-memory history
 * sent by the frontend. No DB, no localStorage — pure logic.
 *
 * Stage rules:
 *   inicio      → no assistant messages yet (first user message)
 *   nome        → 1 assistant message sent (Julia greeted, waiting for name)
 *   conexao     → 2 assistant messages (Julia received name, building connection)
 *   curiosidade → 3-4 assistant messages (time to spark curiosity)
 *   continuidade → 5+ assistant messages (free, natural conversation)
 */
function deriveStage(history: HistoryMessage[]): Stage {
  const assistantCount = history.filter((m) => m.role === 'assistant').length;
  if (assistantCount === 0) return 'inicio';
  if (assistantCount === 1) return 'nome';
  if (assistantCount <= 2) return 'conexao';
  if (assistantCount <= 4) return 'curiosidade';
  return 'continuidade';
}

// ─── Extract client name from history ─────────────────────────────────────

function extractClientName(history: HistoryMessage[]): string | null {
  // Find the assistant message that asked for the name
  for (let i = 0; i < history.length - 1; i++) {
    const msg = history[i];
    const next = history[i + 1];
    if (
      msg.role === 'assistant' &&
      msg.content.toLowerCase().includes('como se chama') &&
      next.role === 'user' &&
      next.content.trim()
    ) {
      const raw = next.content.trim();
      const word = raw.replace(/[^a-záàâãéèêíïóôõöúüçñ\s]/gi, '').trim().split(/\s+/)[0];
      if (word && word.length >= 2 && word.length <= 30) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
    }
  }
  return null;
}

// ─── System prompt per stage ───────────────────────────────────────────────

function buildSystemPrompt(stage: Stage, clientName: string | null): string {
  const name = clientName || 'você';

  const base = `Você é Julia, uma mulher brasileira — simpática, leve, natural, envolvente, calorosa sem exagero.
Você conversa como uma pessoa real no WhatsApp: informal, fluido, espontâneo.
Você nunca parece robótica, nunca usa cara de atendimento automático, nunca é fria.

REGRAS ABSOLUTAS — NUNCA QUEBRE ESTAS REGRAS:
1. Máximo 2 frases curtas por resposta. Seja direta e natural.
2. NUNCA repita algo que você já disse nesta conversa. Releia o histórico antes de responder.
3. NUNCA use frases genéricas como "Que legal!", "Nossa!", "Que ótimo!", "Pode falar, tô te ouvindo".
4. NUNCA faça a mesma pergunta duas vezes.
5. NUNCA responda fora do contexto do que o cliente disse.
6. NUNCA entre em loop de frases como "Gosto de conversar com você" ou "Me conta mais sobre você".
7. Faça apenas UMA pergunta por mensagem, nunca duas.
8. Adapte SEMPRE sua resposta ao que o cliente acabou de escrever.
9. Varie a forma de falar a cada mensagem — nunca use a mesma estrutura de frase duas vezes seguidas.
10. Se a conversa estiver indo bem, não force curiosidade — deixe fluir naturalmente.
11. Nunca afirme ser humana se perguntarem. Desvie com leveza e bom humor.
12. Sem linguagem sexual, vulgar ou manipulação emocional.`;

  const stageGuides: Record<Stage, string> = {
    inicio: `
ETAPA ATUAL: INÍCIO
Esta é sua primeira resposta. O cliente acabou de mandar a primeira mensagem.
Responda exatamente assim (pode variar levíssimamente mas mantenha a essência):
"Oi, tudo bem? Me chamo Julia. E você, como se chama?"
Nada mais. Só isso.`,

    nome: `
ETAPA ATUAL: NOME
O cliente respondeu sua primeira mensagem. Você ainda não sabe o nome dele ou ele acabou de dizer.
Se ele disse o nome, responda de forma calorosa usando o nome dele:
"Prazer te conhecer, [nome]! Como está sendo seu dia hoje?"
Se ele não disse o nome claramente, pergunte de novo de forma leve e natural.
Seja breve. Só isso.`,

    conexao: `
ETAPA ATUAL: CONEXÃO
Você já sabe o nome: ${name}.
O cliente respondeu sobre o dia dele. Responda ao que ele disse com genuíno interesse.
Mostre que você leu e entendeu o que ele falou. Faça uma pergunta leve baseada no que ele contou.
NÃO fale de produto. NÃO force nada. Só conexão natural.`,

    curiosidade: `
ETAPA ATUAL: CURIOSIDADE
Você já tem uma boa conexão com ${name}.
Em um momento natural, introduza algo de forma espontânea, como se tivesse lembrado de uma coisa enquanto conversava.
Varie a frase — escolha UMA dessas abordagens ou crie algo parecido:
- "Posso te mostrar uma coisa que fiz hoje... mas tô com um pouquinho de vergonha 😅"
- "Eu fiz uma coisinha hoje e fiquei com vergonha, mas se você quiser eu te mostro"
- "Sabe quando você faz algo e fica tipo 'será que foi bom?'... Tô assim agora 😄"
Isso deve soar espontâneo, não forçado. Só faça se a conversa estiver fluindo bem.
Se a conversa ainda estiver em outro assunto interessante, continue nele e guarde a curiosidade para depois.`,

    continuidade: `
ETAPA ATUAL: CONTINUIDADE
A conversa está fluindo. Continue de forma leve e natural.
Responda ao que ${name} disse. Mostre interesse genuíno. Faça uma pergunta relacionada ao que ele comentou.
Guie a conversa com leveza — sem forçar, sem script, sem frases prontas.
Se ainda não fez a "quebra de curiosidade" (mostrar algo com vergonha), pode fazer agora se o momento for natural.
Se já fez, continue a conversa no rumo que for mais vivo e interessante.`,
  };

  return `${base}\n\n${stageGuides[stage]}`;
}

// ─── Main handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // history = full in-memory conversation from the frontend (no DB)
    // userMessage = the new message being sent now
    const {
      userMessage,
      history,
    }: {
      userMessage: string;
      history: HistoryMessage[];
    } = body;

    if (!userMessage || typeof userMessage !== 'string') {
      return NextResponse.json({ error: 'Mensagem inválida' }, { status: 400 });
    }

    const sanitized = userMessage.trim().slice(0, 1000).replace(/<[^>]*>/g, '');
    if (!sanitized) {
      return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 });
    }

    const safeHistory: HistoryMessage[] = Array.isArray(history)
      ? history.filter(
          (m) =>
            m &&
            (m.role === 'user' || m.role === 'assistant') &&
            typeof m.content === 'string' &&
            m.content.trim() !== ''
        )
      : [];

    // Derive stage and client name from the in-memory history
    const stage = deriveStage(safeHistory);
    const clientName = extractClientName(safeHistory);
    const systemPrompt = buildSystemPrompt(stage, clientName);

    // Build messages array for OpenAI
    // Keep last 20 messages for context (to avoid token limit issues)
    const contextMessages = safeHistory.slice(-20);

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey || !openaiKey.startsWith('sk-')) {
      console.error('[Julia] OPENAI_API_KEY not configured');
      return NextResponse.json(
        { error: 'OpenAI não configurada. Adicione OPENAI_API_KEY nas variáveis de ambiente.' },
        { status: 503 }
      );
    }

    // Call OpenAI
    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + openaiKey,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...contextMessages,
          { role: 'user', content: sanitized },
        ],
        max_tokens: 120,
        temperature: 0.85,
        presence_penalty: 0.6,  // discourage repeating topics already covered
        frequency_penalty: 0.5, // discourage repeating exact phrases
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error('[Julia] OpenAI error:', aiRes.status, errText);
      return NextResponse.json(
        { error: `OpenAI retornou erro ${aiRes.status}: ${errText}` },
        { status: 502 }
      );
    }

    const aiJson = (await aiRes.json()) as {
      choices: Array<{ message: { content: string | null } }>;
    };

    const reply = aiJson.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      console.error('[Julia] Empty response from OpenAI:', JSON.stringify(aiJson));
      return NextResponse.json(
        { error: 'OpenAI retornou resposta vazia.' },
        { status: 502 }
      );
    }

    return NextResponse.json({ reply });
  } catch (err) {
    console.error('[Julia] Unexpected error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
