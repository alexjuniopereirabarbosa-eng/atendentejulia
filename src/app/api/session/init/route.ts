import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    // 1. Receber no body o conversationId de forma segura
    let body = {};
    try {
      body = await req.json();
    } catch {
      // body pode estar vazio
    }

    const { conversationId } = body as { conversationId?: string };

    // 2. Se conversationId existir, tentar buscar no Supabase
    if (conversationId) {
      const { data: existingConv } = await supabaseAdmin
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

      if (existingConv) {
        // Encontrou a conversa, buscar mensagens ordenadas
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

    // 3. Se NÃO existir ou não enviar ID, criar nova conversa
    const { data: newConv, error: convError } = await supabaseAdmin
      .from('conversations')
      .insert({
        free_used: 0,
        paid_remaining: 0,
        status: 'active',
      })
      .select()
      .single();

    if (convError || !newConv) {
      console.error('Erro na criação de sessão:', convError);
      return NextResponse.json({ error: 'Erro ao criar nova conversa' }, { status: 500 });
    }

    // Retorna a conversa criada e lista de mensagens vazia
    return NextResponse.json({
      conversation: newConv,
      messages: [],
    });

  } catch (err) {
    console.error('Erro geral no Session Init:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
