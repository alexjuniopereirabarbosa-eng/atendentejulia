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

    // Log de diagnostico (remover apos debug)
    const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
    const hasKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    console.log('[Init] env check - url:', hasUrl, 'key:', hasKey);

    // 1. Tentar recuperar pelo conversationId salvo no localStorage
    if (conversationId) {
      const { data: existingConv, error: fetchErr } = await supabaseAdmin
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

      if (fetchErr) {
        console.log('[Init] fetch by id error:', fetchErr.message);
      }

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

    // 2. Tentar recuperar pelo fingerprint
    if (fingerprint) {
      const { data: rows, error: fpErr } = await supabaseAdmin
        .from('conversations')
        .select('*')
        .eq('fingerprint', fingerprint)
        .order('created_at', { ascending: false })
        .limit(5);

      if (fpErr) {
        console.log('[Init] fetch by fingerprint error:', fpErr.message);
      }

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

    // 3. Criar nova conversa
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
      console.error('[Init] insert error:', convError?.message, convError?.code, convError?.details);
      return NextResponse.json(
        { error: 'Erro ao criar conversa', details: convError?.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      conversation: newConv,
      messages: [],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Init] exception:', msg);
    return NextResponse.json({ error: 'Erro interno: ' + msg }, { status: 500 });
  }
}
