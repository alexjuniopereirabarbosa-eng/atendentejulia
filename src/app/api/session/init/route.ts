import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    let body: { conversationId?: string; fingerprint?: string } = {};
    try { body = await req.json(); } catch { /* vazio */ }

    const { conversationId } = body;
    const db = getSupabaseAdmin();

    // 1. Recuperar conversa existente pelo ID salvo no cliente
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
          .order('created_at', { ascending: true });

        return NextResponse.json({
          conversation: existingConv,
          messages: messages || [],
        });
      }
    }

    // 2. Criar nova conversa
    const { data: newConv, error: convError } = await db
      .from('conversations')
      .insert({ free_used: 0, paid_remaining: 0, status: 'active' })
      .select()
      .single();

    if (convError || !newConv) {
      console.error('[Init] insert error:', convError?.message);
      return NextResponse.json({ error: 'Erro ao criar conversa' }, { status: 500 });
    }

    return NextResponse.json({ conversation: newConv, messages: [] });
  } catch (err) {
    console.error('[Init] exception:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
