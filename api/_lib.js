// ============================================================
// AI Gateway — Central model routing for Biology Study Hub
// ============================================================
// Model assignments (verified 2026-07-09 via bigmodel.cn docs):
//   Text tasks  → glm-5.2      (flagship text, thinking: max)
//   Vision      → glm-5v-turbo  (multimodal vision)
//   Embedding   → embedding-3   (1024-dim vectors)
//   DeepSeek    → deepseek-chat (backup text reasoning)
// reasoning_effort: max (GLM-5.2 exclusive)
// Endpoint: /api/coding/paas/v4 (Coding Plan)
// ============================================================

const ZHIPU_CHAT_URL = 'https://open.bigmodel.cn/api/coding/paas/v4/chat/completions';
const DEEPSEEK_CHAT_URL = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_EMBED_URL = 'https://api.deepseek.com/embeddings';

// Model registry
export const MODELS = {
  TEXT: 'glm-5.2',
  VISION: 'glm-5v-turbo',
  MCP: 'glm-4.6',
  EMBEDDING: 'deepseek-embedding',
  DEEPSEEK: 'deepseek-chat',
};

export function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export function json(res, data, status = 200) {
  res.status(status).json(data);
}

// Backward-compatible exports for older API routes
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

/**
 * Call GLM (Zhipu) — unified gateway for all GLM models
 * @param {Array} messages - chat messages
 * @param {Object} options - { model, max_tokens, temperature, thinking, reasoning_effort }
 */
export async function callGLM(messages, options = {}) {
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) throw new Error('ZHIPU_API_KEY not configured');

  const body = {
    model: options.model || MODELS.TEXT,
    messages,
    max_tokens: options.max_tokens || 2000,
    temperature: options.temperature ?? 0.3,
  };

  // Enable maximum thinking effort by default
  // GLM-5.2: reasoning_effort controls depth (max | high | medium | low | none)
  if (options.thinking !== false) {
    body.thinking = { type: 'enabled' };
    body.reasoning_effort = options.reasoning_effort || 'max';
  }

  if (options.response_format) {
    body.response_format = options.response_format;
  }

  const resp = await fetch(ZHIPU_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`GLM API error ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  return data.choices[0].message.content;
}

/**
 * Call DeepSeek — backup text reasoning
 */
export async function callDeepSeek(messages, options = {}) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY not configured');

  const body = {
    model: options.model || MODELS.DEEPSEEK,
    messages,
    max_tokens: options.max_tokens || 2000,
    temperature: options.temperature ?? 0.3,
  };

  if (options.response_format) {
    body.response_format = options.response_format;
  }

  const resp = await fetch(DEEPSEEK_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`DeepSeek API error ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  return data.choices[0].message.content;
}

/**
 * Get embedding vector via DeepSeek (1024-dim)
 * Note: GLM Coding Plan does not include embedding quota,
 * so we use DeepSeek's embedding model instead.
 */
export async function getEmbedding(text) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY not configured');

  const resp = await fetch(DEEPSEEK_EMBED_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODELS.EMBEDDING,
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

/**
 * Convenience: vision call via GLM-5V-Turbo with thinking enabled
 */
export async function callVision(imageBase64, prompt, options = {}) {
  return callGLM(
    [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: imageBase64 } },
        { type: 'text', text: prompt || 'Describe this image in detail.' }
      ]
    }],
    { model: MODELS.VISION, max_tokens: options.max_tokens || 1500, thinking: true, reasoning_effort: 'max' }
  );
}
