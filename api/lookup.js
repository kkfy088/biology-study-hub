import { callGLM, setCORS, json, MODELS } from './_lib.js';

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, { error: 'Method not allowed' }, 405);

  try {
    const { word } = req.body;
    if (!word) return json(res, { error: 'Missing word' }, 400);

    const prompt = `你是一个生物学词典。请查询单词 "${word}" 并返回 JSON：
{
  "ipa": "国际音标",
  "cn": "中文翻译",
  "def_en": "英文释义（生物学语境）",
  "def_cn": "中文释义",
  "examples": ["例句1", "例句2"]
}
只返回 JSON，不要其他文字。`;

    const result = await callGLM(
      [{ role: 'user', content: prompt }],
      { model: MODELS.TEXT, temperature: 0.1, thinking: false, response_format: { type: 'json_object' } }
    );

    return json(res, JSON.parse(result));
  } catch (err) {
    return json(res, { error: err.message }, 500);
  }
}
