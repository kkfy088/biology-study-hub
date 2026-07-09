// ============================================================
// AI Gateway — Central model routing for Biology Study Hub
// ============================================================
// Model assignments (verified 2026-07-09):
//   Text tasks  → GLM-5.2      (flagship text, 1M context)
//   Vision      → GLM-5V-Turbo  (multimodal vision)
//   MCP/Agent   → GLM-4.6       (tool calling)
//   Embedding   → embedding-3   (1024-dim vectors)
//   DeepSeek    → deepseek-v4-pro (backup reasoning)
// Effort: maximum thinking enabled by default
// ============================================================

const ZHIPU_CHAT_URL = 'https://open.bigmodel.cn/api/coding/paas/v4/chat/completions';
const ZHIPU_EMBED_URL = 'https://open.bigmodel.cn/api/coding/paas/v4/embeddings';
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';

// Model registry
export const MODELS = {
  TEXT: 'glm-5.2',
  VISION: 'glm-5v-turbo',
  MCP: 'glm-4.6',
  EMBEDDING: 'embedding-3',
  DEEPSEEK: 'deepseek-v4-pro',
};

export function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export function json(res, data, status = 200) {
  res.status(status).json(data);
}

/**
 * Call GLM (Zhipu) — unified gateway for all GLM models
 * @param {Array} messages - chat messages
 * @param {Object} options - { model, max_tokens, temperature, thinking }
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
  // GLM-5.2 supports reasoning_effort, other models use thinking.enabled
  if (options.thinking !== false) {
    body.thinking = { type: 'enabled' };
    // GLM-5.2 专属：reasoning_effort = max
    body.reasoning_effort = 'max';
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
 * Call DeepSeek V4-Pro — maximum reasoning effort
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

  // Enable maximum thinking effort
  if (options.thinking !== false) {
    body.thinking = { type: 'think_max' };
  }

  if (options.response_format) {
    body.response_format = options.response_format;
  }

  const resp = await fetch(DEEPSEEK_URL, {
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
 * Get embedding vector (1024-dim for embedding-3)
 */
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
      model: MODELS.EMBEDDING,
      input: text,
      dimensions: 1024,
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
 * Convenience: vision call via GLM-5V-Turbo
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
    { model: MODELS.VISION, max_tokens: options.max_tokens || 1500, thinking: true }
  );
}
