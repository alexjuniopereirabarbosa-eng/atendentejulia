import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const { conversationId } = await req.json();

    if (!conversationId) {
      return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
    }

    // Force unlock: set 30 paid messages
    const { error } = await supabaseAdmin
      .from('conversations')
      .update({
        status: 'paid',
        paid_remaining: 30,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId);

    if (error) throw error;

    // Add system message
    await supabaseAdmin.from('messages').insert({
      conversation_id: conversationId,
      sender: 'system',
      content: '✨ Conversa liberada manualmente pelo admin. 30 mensagens adicionais disponíveis.',
      message_type: 'system',
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Force unlock error:', err);
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}
