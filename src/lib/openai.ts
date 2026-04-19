import OpenAI from 'openai';

/**
 * Verifica se a OpenAI esta configurada corretamente.
 * Suporta chaves sk- e sk-proj-.
 */
export function isOpenAIConfigured(): boolean {
  const key = process.env.OPENAI_API_KEY;
  return !!key && key !== 'sk-placeholder' && key.startsWith('sk-');
}

/**
 * Retorna um cliente OpenAI criado em runtime (lazy),
 * garantindo que a variavel de ambiente seja lida apos o boot.
 */
export function getOpenAIClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'sk-placeholder',
  });
}

// Exporta instancia padrao para compatibilidade com imports existentes
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-placeholder',
});
