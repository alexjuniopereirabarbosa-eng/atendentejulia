import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getPaymentById, validateWebhookSignature, isMercadoPagoConfigured } from '@/lib/mercadopago';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Mercado Pago sends different notification types
    const { type, data, action } = body;

    // Only process payment notifications
    if (type !== 'payment' && action !== 'payment.updated') {
      return NextResponse.json({ received: true });
    }

    const paymentId = data?.id;
    if (!paymentId) {
      return NextResponse.json({ error: 'Missing payment ID' }, { status: 400 });
    }

    // Validate webhook signature
    const xSignature = req.headers.get('x-signature');
    const xRequestId = req.headers.get('x-request-id');
    
    if (!validateWebhookSignature(xSignature, xRequestId, String(paymentId))) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Safe verify MP Configs so it doesn't crash here
    if (!isMercadoPagoConfigured()) {
      console.warn('Webhook recebido, mas mercado pago não configurado (ignorado)');
      return NextResponse.json({ error: 'MP_NOT_CONFIGURED' }, { status: 503 });
    }

    // Get payment details from Mercado Pago
    const mpPayment = await getPaymentById(String(paymentId));

    if (!mpPayment || mpPayment.status !== 'approved') {
      // Not approved yet, just acknowledge
      return NextResponse.json({ received: true, status: mpPayment?.status });
    }

    const conversationId = mpPayment.external_reference;

    if (!conversationId) {
      console.error('No external_reference in payment');
      return NextResponse.json({ error: 'Missing reference' }, { status: 400 });
    }

    // Update payment record
    await supabaseAdmin
      .from('payments')
      .update({
        status: 'approved',
        external_payment_id: String(paymentId),
        paid_at: new Date().toISOString(),
      })
      .eq('conversation_id', conversationId)
      .eq('status', 'pending');

    // Unlock conversation: accumulatively add 30 paid responses and status paid
    const { data: conversation } = await supabaseAdmin
      .from('conversations')
      .select('total_paid_cycles, paid_remaining')
      .eq('id', conversationId)
      .single();

    const currentCycles = conversation?.total_paid_cycles || 0;
    const currentRemaining = conversation?.paid_remaining || 0;

    await supabaseAdmin
      .from('conversations')
      .update({
        status: 'paid',
        paid_remaining: currentRemaining + 30,
        total_paid_cycles: currentCycles + 1,
        current_cycle_images_sent: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId);

    // Add system message
    await supabaseAdmin.from('messages').insert({
      conversation_id: conversationId,
      sender: 'system',
      content: '✨ Pagamento aprovado! Suas mensagens foram liberadas. Continue conversando com Julia.',
      message_type: 'system',
    });

    console.log(`Payment approved for conversation: ${conversationId}`);

    return NextResponse.json({ received: true, status: 'approved' });
  } catch (err) {
    console.error('Webhook error:', err);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
