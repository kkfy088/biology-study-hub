// Shared utilities for all API routes

export const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
export const ZHIPU_CHAT_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
export const ZHIPU_EMBED_URL = 'https://open.bigmodel.cn/api/paas/v4/embeddings';

// CORS headers
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

export async function callDeepSeek(messages, options = {}) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY not configured');

  const resp = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: options.model || 'deepseek-chat',
      messages,
      max_tokens: options.max_tokens || 800,
      temperature: options.temperature ?? 0.3,
      response_format: options.response_format,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`DeepSeek API error ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  return data.choices[0].message.content;
}

export async function callGLM(messages, options = {}) {
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) throw new Error('ZHIPU_API_KEY not configured');

  const resp = await fetch(ZHIPU_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: options.model || 'glm-4-flash',
      messages,
      max_tokens: options.max_tokens || 800,
      temperature: options.temperature ?? 0.3,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`GLM API error ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  return data.choices[0].message.content;
}

export async function getEmbedding(text) {
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) throw new Error('ZHIPU_API_KEY not configured');

  const resp = await fetch(ZHIPU_EMBED_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'embedding-3',
      input: text,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Embedding API error ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  return data.data[0].embedding;
}
