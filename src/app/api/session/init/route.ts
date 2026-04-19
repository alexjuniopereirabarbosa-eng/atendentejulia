import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    let body: { conversationId?: string; fingerprint?: string } = {};
    try {
      body = await req.json();
    } catch {
      // body vazio
    }

    const { conversationId, fingerprint } = body;

    // 1. Tentar recuperar pelo conversationId salvo no localStorage
    if (conversationId) {
      const { data: existingConv } = await supabaseAdmin
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

      if (existingConv) {
        const { data: messages } = await supabaseAdmin
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

    // 2. Tentar recuperar pelo fingerprint (conversa ativa)
    if (fingerprint) {
      const { data: rows } = await supabaseAdmin
        .from('conversations')
        .select('*')
        .eq('fingerprint', fingerprint)
        .order('created_at', { ascending: false })
        .limit(5);

      const activeConv = (rows || []).find(
        (c) => c.status !== 'blocked_free_limit' && c.status !== 'blocked_paid_limit'
      );

      if (activeConv) {
        const { data: messages } = await supabaseAdmin
          .from('messages')
          .select('*')
          .eq('conversation_id', activeConv.id)
          .order('created_at', { ascending: true });

        return NextResponse.json({
          conversation: activeConv,
          messages: messages || [],
        });
      }
    }

    // 3. Criar nova conversa com user_id anonimo
    const anonymousUserId = crypto.randomUUID();

    const { data: newConv, error: convError } = await supabaseAdmin
      .from('conversations')
      .insert({
        user_id: anonymousUserId,
        free_used: 0,
        paid_remaining: 0,
        status: 'active',
        fingerprint: fingerprint || null,
      })
      .select()
      .single();

    if (convError || !newConv) {
      console.error('Erro na criacao de sessao:', convError);
      return NextResponse.json({ error: 'Erro ao criar nova conversa' }, { status: 500 });
    }

    return NextResponse.json({
      conversation: newConv,
      messages: [],
    });
  } catch (err) {
    console.error('Erro geral no Session Init:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
