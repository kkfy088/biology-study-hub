// ============================================================
// AI Gateway — Central model routing for Biology Study Hub
// ============================================================
// Model assignments (updated 2026-07-10):
//   Text tasks  → deepseek-chat   (primary, via DeepSeek API)
//   Vision      → glm-4.6v-flash   (free tier, via GLM standard API)
//   Embedding   → embedding-3      (2048-dim, via GLM standard API)
// ============================================================

const ZHIPU_CHAT_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const ZHIPU_EMBED_URL = 'https://open.bigmodel.cn/api/paas/v4/embeddings';
const DEEPSEEK_CHAT_URL = 'https://api.deepseek.com/chat/completions';

// Model registry
export const MODELS = {
  TEXT: 'deepseek-chat',
  VISION: 'glm-4.6v-flash',
  VISION_PRO: 'glm-5v-turbo',
  EMBEDDING: 'embedding-3',
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
 * Call GLM (Zhipu) standard API — used for vision (glm-5v-turbo)
 * Text tasks use callDeepSeek instead.
 * @param {Array} messages - chat messages
 * @param {Object} options - { model, max_tokens, temperature, thinking, reasoning_effort }
 */
export async function callGLM(messages, options = {}) {
  const apiKey = process.env.GLM_VISION_4_6V_FLASH_API_KEY;
  if (!apiKey) throw new Error('GLM_VISION_4_6V_FLASH_API_KEY not configured');

  const body = {
    model: options.model || MODELS.VISION,
    messages,
    max_tokens: options.max_tokens || 2000,
    temperature: options.temperature ?? 0.3,
  };

  // Only enable thinking when explicitly requested (glm-5 series only)
  if (options.thinking === true) {
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
 * Call DeepSeek — primary text reasoning
 */
export async function callDeepSeek(messages, options = {}) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY not configured');

  const body = {
    model: options.model || MODELS.TEXT,
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
 * Get embedding vector via Zhipu standard API (2048-dim)
 * Uses ZHIPU_EMBEDDING_API_KEY (dedicated embedding key/quota).
 */
export async function getEmbedding(text) {
  const apiKey = process.env.ZHIPU_EMBEDDING_API_KEY;
  if (!apiKey) throw new Error('ZHIPU_EMBEDDING_API_KEY not configured');

  const resp = await fetch(ZHIPU_EMBED_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODELS.EMBEDDING,
      input: text,
      dimensions: 2048,
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
 * Convenience: vision call via GLM-4.6V-Flash (free tier)
 * Pass options.model = MODELS.VISION_PRO to use glm-5v-turbo instead.
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
    { model: options.model || MODELS.VISION, max_tokens: options.max_tokens || 1500 }
  );
}
