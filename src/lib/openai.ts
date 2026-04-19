import OpenAI from 'openai';

let _client: OpenAI | null = null;

/**
 * Retorna o cliente OpenAI criado sob demanda (lazy),
 * garantindo que a variável de ambiente seja lida em runtime e não no boot.
 */
export function getOpenAIClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    _client = new OpenAI({ apiKey: apiKey || 'sk-placeholder' });
  }
  return _client;
}

/**
 * Verifica se a OpenAI está configurada corretamente.
 * Lido em runtime para suportar chaves sk- e sk-proj-.
 */
export function isOpenAIConfigured(): boolean {
  const key = process.env.OPENAI_API_KEY;
  return !!key && key !== 'sk-placeholder' && key.startsWith('sk-');
}

// Mantém compatibilidade com imports existentes que usam `openai` diretamente
export const openai = {
  chat: {
    completions: {
      create: (params: Parameters<OpenAI['chat']['completions']['create']>[0]) =>
        getOpenAIClient().chat.completions.create(params),
    },
  },
};
