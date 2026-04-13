import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

/**
 * Check if Mercado Pago is properly configured
 */
export function isMercadoPagoConfigured(): boolean {
  return !!process.env.MERCADOPAGO_ACCESS_TOKEN;
}

function getMercadoPagoClient(): MercadoPagoConfig {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error(
      '[Julia] MERCADOPAGO_ACCESS_TOKEN não configurado. ' +
      'Configure a variável de ambiente para habilitar pagamentos.'
    );
  }
  return new MercadoPagoConfig({ accessToken });
}

export async function createPaymentPreference(conversationId: string) {
  if (!isMercadoPagoConfigured()) {
    throw new Error(
      'Mercado Pago não está configurado. Preencha MERCADOPAGO_ACCESS_TOKEN no .env.local'
    );
  }

  const client = getMercadoPagoClient();
  const preference = new Preference(client);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const result = await preference.create({
    body: {
      items: [
        {
          id: `julia-chat-${conversationId}`,
          title: 'Liberar conversa com Julia',
          description: 'Liberação de 30 respostas adicionais da Julia',
          quantity: 1,
          unit_price: 19.90,
          currency_id: 'BRL',
        },
      ],
      back_urls: {
        success: `${appUrl}/chat?payment=success`,
        failure: `${appUrl}/chat?payment=failure`,
        pending: `${appUrl}/chat?payment=pending`,
      },
      auto_return: 'approved',
      external_reference: conversationId,
      notification_url: `${appUrl}/api/payment/webhook`,
    },
  });

  return result;
}

export async function getPaymentById(paymentId: string) {
  if (!isMercadoPagoConfigured()) {
    throw new Error('Mercado Pago não configurado');
  }
  const client = getMercadoPagoClient();
  const payment = new Payment(client);
  return await payment.get({ id: paymentId });
}

/**
 * Validate the Mercado Pago webhook signature
 */
export function validateWebhookSignature(
  xSignature: string | null,
  xRequestId: string | null,
  dataId: string, // eslint-disable-line @typescript-eslint/no-unused-vars
): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('[Julia] MERCADOPAGO_WEBHOOK_SECRET não configurado — pulando validação de assinatura');
    return true; // In development, allow through
  }

  if (!xSignature || !xRequestId) {
    return false;
  }

  // In production, implement full HMAC-SHA256 validation here
  // See: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
  return true;
}
