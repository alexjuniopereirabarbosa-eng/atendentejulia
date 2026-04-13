import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const { conversationId, imageIndex } = await req.json();

    if (!conversationId) {
      return NextResponse.json({ error: 'ID da conversa obrigatório' }, { status: 400 });
    }

    // Check conversation state
    const { data: conversation, error: convError } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 });
    }

    if (conversation.status !== 'paid' || conversation.paid_remaining <= 0) {
      return NextResponse.json({ error: 'Conversa não está no ciclo pago' }, { status: 400 });
    }

    if (conversation.current_cycle_images_sent >= 2) {
      return NextResponse.json({ error: 'Limite de imagens do ciclo atingido' }, { status: 400 });
    }

    // Get available paid images
    const { data: images } = await supabaseAdmin
      .from('assistant_assets')
      .select('*')
      .eq('asset_type', 'paid_image')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    const idx = imageIndex ?? conversation.current_cycle_images_sent;
    const image = images?.[idx];

    if (!image) {
      return NextResponse.json({ error: 'Imagem não encontrada' }, { status: 404 });
    }

    // Save image message
    await supabaseAdmin.from('messages').insert({
      conversation_id: conversationId,
      sender: 'assistant',
      content: null,
      message_type: 'image',
      image_url: image.asset_url,
    });

    // Update image counter
    await supabaseAdmin
      .from('conversations')
      .update({
        current_cycle_images_sent: conversation.current_cycle_images_sent + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId);

    return NextResponse.json({ success: true, imageUrl: image.asset_url });
  } catch (err) {
    console.error('Send image error:', err);
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}
