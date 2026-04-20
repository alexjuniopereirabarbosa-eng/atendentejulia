import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';

// Julia's opening message — always the same first line
const OPENING_MESSAGE =
  'Oi, tudo bem? Me chamo Julia. E você, como se chama?';

export async function POST(req: NextRequest) {
  try {
    let body: { conversationId?: string; fingerprint?: string } = {};
    try {
      body = await req.json();
    } catch {
      /* empty body is fine */
    }

    const { conversationId } = body;
    const db = getSupabaseAdmin();

    // ── 1. Try to recover existing conversation ──────────────────────────
    if (conversationId) {
      const { data: existingConv } = await db
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

      if (existingConv) {
        const { data: messages } = await db
          .from('messages')
          .select('*')
          .eq('conversation_id', existingConv.id)
          .neq('message_type', 'system')
          .order('created_at', { ascending: true });

        return NextResponse.json({
          conversation: existingConv,
          messages: messages || [],
        });
      }
    }

    // ── 2. Create new conversation ───────────────────────────────────────
    const { data: newConv, error: convError } = await db
      .from('conversations')
      .insert({ free_used: 0, paid_remaining: 0, status: 'active' })
      .select()
      .single();

    if (convError || !newConv) {
      console.error('[Init] insert error:', convError?.message);
      return NextResponse.json({ error: 'Erro ao criar conversa' }, { status: 500 });
    }

    // ── 3. Save Julia's opening message as the first assistant message ───
    const { data: openingMsg, error: openingError } = await db
      .from('messages')
      .insert({
        conversation_id: newConv.id,
        sender: 'assistant',
        content: OPENING_MESSAGE,
        message_type: 'text',
      })
      .select()
      .single();

    if (openingError) {
      console.error('[Init] opening message error:', openingError?.message);
      // Still return the conversation — just without the opening message
      return NextResponse.json({ conversation: newConv, messages: [] });
    }

    return NextResponse.json({
      conversation: newConv,
      messages: [openingMsg],
    });
  } catch (err) {
    console.error('[Init] exception:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
