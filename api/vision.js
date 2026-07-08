import { callGLM, jsonResponse, CORS_HEADERS } from './_lib.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const { image, prompt } = await req.json();
    if (!image) return jsonResponse({ error: 'Missing image' }, 400);

    const textPrompt = prompt || '请用中文详细解释这张生物图：1）图中展示了什么结构/过程 2）标注各部分名称和功能 3）考试常考点。术语用"英文（中文）"格式。';

    const result = await callGLM(
      [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: image } },
          { type: 'text', text: textPrompt }
        ]
      }],
      { model: 'glm-4v-flash', max_tokens: 1000 }
    );

    return jsonResponse({ description: result });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}
