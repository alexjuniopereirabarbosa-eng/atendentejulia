import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    let body: { conversationId?: string; fingerprint?: string } = {};
    try {
      body = await req.json();
    } catch {
      // body pode estar vazio
    }

    const { conversationId, fingerprint } = body;

    // 1. Se vier um conversationId, tentar recuperar a conversa existente
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

    // 2. Se vier fingerprint, tentar recuperar conversa ativa pelo fingerprint
    if (fingerprint) {
      const { data: convByFingerprint } = await supabaseAdmin
        .from('conversations')
        .select('*')
        .eq('fingerprint', fingerprint)
        .not('status', 'in', '("blocked_free_limit","blocked_paid_limit")')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (convByFingerprint) {
        const { data: messages } = await supabaseAdmin
          .from('messages')
          .select('*')
          .eq('conversation_id', convByFingerprint.id)
          .order('created_at', { ascending: true });

        return NextResponse.json({
          conversation: convByFingerprint,
          messages: messages || [],
        });
      }
    }

    // 3. Criar nova conversa
    const { data: newConv, error: convError } = await supabaseAdmin
      .from('conversations')
      .insert({
        free_used: 0,
        paid_remaining: 0,
        status: 'active',
        fingerprint: fingerprint || null,
      })
      .select()
      .single();

    if (convError || !newConv) {
      console.error('Erro na criação de sessão:', convError);
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
