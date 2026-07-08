import { callDeepSeek, jsonResponse, CORS_HEADERS } from './_lib.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const { text } = await req.json();
    if (!text) return jsonResponse({ error: 'Missing text' }, 400);

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

    const result = await callDeepSeek(
      [{ role: 'user', content: prompt }],
      { temperature: 0.2, response_format: { type: 'json_object' } }
    );

    return jsonResponse(JSON.parse(result));
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}
