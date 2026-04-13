import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { createPaymentPreference, isMercadoPagoConfigured } from '@/lib/mercadopago';

export async function POST(req: NextRequest) {
  try {
    const { conversationId } = await req.json();

    if (!conversationId) {
      return NextResponse.json({ error: 'ID da conversa obrigatório' }, { status: 400 });
    }

    // Check if Mercado Pago is configured
    if (!isMercadoPagoConfigured()) {
      return NextResponse.json(
        { error: 'Sistema de pagamento não configurado. Entre em contato com o suporte.' },
        { status: 503 }
      );
    }

    // Verify conversation exists and is blocked
    const { data: conversation, error: convError } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 });
    }

    if (
      conversation.status !== 'blocked_free_limit' &&
      conversation.status !== 'blocked_paid_limit'
    ) {
      return NextResponse.json({ error: 'Conversa não está bloqueada' }, { status: 400 });
    }

    // Create Mercado Pago preference
    const preference = await createPaymentPreference(conversationId);

    // Save payment record
    const { data: payment, error: payError } = await supabaseAdmin
      .from('payments')
      .insert({
        conversation_id: conversationId,
        provider: 'mercadopago',
        external_payment_id: preference.id,
        amount: 19.90,
        status: 'pending',
      })
      .select()
      .single();

    if (payError) {
      console.error('Payment save error:', payError);
    }

    return NextResponse.json({
      paymentId: payment?.id,
      checkoutUrl: preference.init_point,
      sandboxUrl: preference.sandbox_init_point,
    });
  } catch (err) {
    console.error('Payment create error:', err);
    return NextResponse.json({ error: 'Erro ao criar pagamento' }, { status: 500 });
  }
}
