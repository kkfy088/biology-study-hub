import { callGLM, setCORS, json } from './_lib.js';

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, { error: 'Method not allowed' }, 405);

  try {
    const { image, prompt } = req.body;
    if (!image) return json(res, { error: 'Missing image' }, 400);

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

    return json(res, { description: result });
  } catch (err) {
    return json(res, { error: err.message }, 500);
  }
}
