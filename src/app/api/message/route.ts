import { NextRequest, NextResponse } from 'next/server';

// ─── Types ─────────────────────────────────────────────────────────────────

type Stage = 'inicio' | 'nome' | 'curiosidade' | 'foto_enviada' | 'continuidade';

interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ─── Image to send when client accepts ─────────────────────────────────────

const PREVIEW_IMAGE_URL =
  'https://i.ibb.co/Sws93gLr/Create-a-highly-202604061657-1.jpg';

const FOLLOW_UP_MESSAGE =
  'Tenho algo a mais para te mostrar, porém é para poucos... você queria ver?';

// ─── Positive intent detection ─────────────────────────────────────────────

const POSITIVE_TERMS = [
  'sim', 'claro', 'pode', 'manda', 'mostra', 'quero', 'quero ver',
  'manda sim', 'pode mostrar', 'uhum', 'uh hum', 'tô curioso',
  'to curioso', 'tô curiosa', 'to curiosa', 'vai', 'bora', 'show',
  'pode mandar', 'manda aí', 'manda ai', 'yes', 'yep', 'ok', 'okay',
  'beleza', 'com certeza', 'por favor', 'pfv', 'pf', 'quero sim',
];

function isPositiveResponse(text: string): boolean {
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  return POSITIVE_TERMS.some(
    (t) => normalized === t || normalized.startsWith(t + ' ') || normalized.endsWith(' ' + t)
  );
}

// ─── Stage derivation ──────────────────────────────────────────────────────

/**
 * Derive stage from in-memory history:
 *
 *  inicio       → 0 assistant messages
 *  nome         → 1 assistant message (Julia greeted, knows name next)
 *  curiosidade  → 2-3 assistant messages (Julia must introduce curiosity by msg 4)
 *  foto_enviada → assistant already sent the image URL in a previous message
 *  continuidade → after the image flow
 */
function deriveStage(history: HistoryMessage[]): Stage {
  const assistantMsgs = history.filter((m) => m.role === 'assistant');
  const assistantCount = assistantMsgs.length;

  // If image was already sent, we're past the photo stage
  const imageSent = assistantMsgs.some((m) => m.content.includes(PREVIEW_IMAGE_URL));
  if (imageSent) return 'continuidade';

  // If Julia already asked the curiosity question, check if client responded positively
  const curiosityAsked = assistantMsgs.some(
    (m) =>
      m.content.toLowerCase().includes('vergonha') ||
      m.content.toLowerCase().includes('posso te mostrar')
  );

  if (curiosityAsked) {
    // Check if the last user message is a positive response
    const lastUserMsg = [...history].reverse().find((m) => m.role === 'user');
    if (lastUserMsg && isPositiveResponse(lastUserMsg.content)) {
      return 'foto_enviada';
    }
    // Curiosity asked but client hasn't responded positively yet
    return 'continuidade';
  }

  if (assistantCount === 0) return 'inicio';
  if (assistantCount === 1) return 'nome';
  return 'curiosidade'; // msgs 2-3: Julia MUST introduce curiosity here
}

// ─── Extract client name ───────────────────────────────────────────────────

function extractClientName(history: HistoryMessage[]): string | null {
  for (let i = 0; i < history.length - 1; i++) {
    const msg = history[i];
    const next = history[i + 1];
    if (
      msg.role === 'assistant' &&
      msg.content.toLowerCase().includes('como se chama') &&
      next.role === 'user' &&
      next.content.trim()
    ) {
      const word = next.content
        .trim()
        .replace(/[^a-záàâãéèêíïóôõöúüçñ\s]/gi, '')
        .trim()
        .split(/\s+/)[0];
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

  const base = `Você é Julia — mulher brasileira, simpática, natural, leve, objetiva.
Você conversa como uma amiga no WhatsApp: direta, calorosa, sem enrolação.

REGRAS ABSOLUTAS:
1. Máximo 2 frases curtas por resposta.
2. NUNCA repita o que já disse antes.
3. NUNCA use frases genéricas como "Que legal!" ou "Nossa!".
4. NUNCA faça a mesma pergunta duas vezes.
5. NUNCA entre em loop. Se a conversa está fluindo, avance.
6. Nunca afirme ser humana se perguntarem diretamente.
7. Sem linguagem sexual ou vulgar.`;

  const guides: Record<Stage, string> = {
    inicio: `
ETAPA: INÍCIO
Primeira resposta. Escreva exatamente:
"Oi, tudo bem? Me chamo Julia. E você, como se chama?"
Nada mais.`,

    nome: `
ETAPA: NOME
O cliente respondeu. Você já sabe ou vai descobrir o nome.
Se ele disse o nome, responda de forma calorosa:
"Prazer te conhecer, [nome]! Como está sendo seu dia hoje?"
Seja breve. Só isso.`,

    curiosidade: `
ETAPA: CURIOSIDADE — OBRIGATÓRIA
Você DEVE soltar a frase de curiosidade agora. Não adie mais.
Escolha UMA dessas variações (varie, não repita sempre igual):
- "Posso te mostrar uma coisa que fiz hoje... tô com um pouquinho de vergonha 😅"
- "Posso te mostrar uma coisinha que fiz hoje? Tô até com vergonha de te mostrar"
- "Eu fiz uma coisa hoje e fiquei com vergonha, mas se você quiser eu te mostro"
- "Fiz algo hoje que não sei se tenho coragem de mostrar... mas tô com vontade 😄"

Se o cliente ainda está falando de outro assunto, responda brevemente ao que ele disse e logo em seguida solte a curiosidade.
Máximo 2 frases: resposta + curiosidade.`,

    foto_enviada: `
ETAPA: FOTO ENVIADA
O cliente disse que quer ver. Não responda em texto — o sistema já vai enviar a imagem automaticamente.
Não escreva nada aqui — o backend cuida disso.`,

    continuidade: `
ETAPA: CONTINUIDADE
A conversa está fluindo. Continue de forma leve e natural com ${name}.
Responda ao que o cliente disse. Uma pergunta leve no máximo.
Sem enrolação, sem repetição, sem loop.`,
  };

  return `${base}\n\n${guides[stage]}`;
}

// ─── Main handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userMessage, history }: { userMessage: string; history: HistoryMessage[] } = body;

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

    const stage = deriveStage(safeHistory);
    const clientName = extractClientName(safeHistory);

    // ── Special case: client accepted to see the photo ─────────────────────
    if (stage === 'foto_enviada') {
      return NextResponse.json({
        reply: null,           // no text reply
        imageUrl: PREVIEW_IMAGE_URL,
        followUp: FOLLOW_UP_MESSAGE,
      });
    }

    // ── Build OpenAI request ───────────────────────────────────────────────
    const systemPrompt = buildSystemPrompt(stage, clientName);
    const contextMessages = safeHistory.slice(-20);

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey || !openaiKey.startsWith('sk-')) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY não configurada nas variáveis de ambiente.' },
        { status: 503 }
      );
    }

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
        max_tokens: 100,
        temperature: 0.85,
        presence_penalty: 0.6,
        frequency_penalty: 0.5,
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
      return NextResponse.json({ error: 'OpenAI retornou resposta vazia.' }, { status: 502 });
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
