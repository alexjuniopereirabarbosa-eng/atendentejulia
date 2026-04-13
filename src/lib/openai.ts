import OpenAI from 'openai';

function createOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.warn('[Julia] OPENAI_API_KEY não configurada — IA não funcionará');
  }

  return new OpenAI({
    apiKey: apiKey || 'sk-placeholder',
  });
}

export const openai = createOpenAIClient();

/**
 * Check if OpenAI is properly configured
 */
export function isOpenAIConfigured(): boolean {
  const key = process.env.OPENAI_API_KEY;
  return !!key && key !== 'sk-placeholder' && key.startsWith('sk-');
}
