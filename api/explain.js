import { callGLM, setCORS, json, MODELS } from './_lib.js';

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, { error: 'Method not allowed' }, 405);

  try {
    const { text } = req.body;
    if (!text) return json(res, { error: 'Missing text' }, 400);

    const prompt = `你是一个生物学英语教师。请分析以下句子并返回 JSON：
句子: "${text}"

{
  "translation": "完整中文翻译",
  "structure": "句子结构分析（主谓宾）",
  "key_terms": [
    {"term": "英文术语", "cn": "中文", "role": "在句中的功能"}
  ],
  "explanation": "为什么这句话这么说（1-2句中文解释）"
}
只返回 JSON。`;

    const result = await callGLM(
      [{ role: 'user', content: prompt }],
      { model: MODELS.TEXT, temperature: 0.2, thinking: false, response_format: { type: 'json_object' } }
    );

    return json(res, JSON.parse(result));
  } catch (err) {
    return json(res, { error: err.message }, 500);
  }
}
