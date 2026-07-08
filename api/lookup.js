import { callDeepSeek, jsonResponse, CORS_HEADERS } from './_lib.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const { word } = await req.json();
    if (!word) return jsonResponse({ error: 'Missing word' }, 400);

    const prompt = `你是一个生物学词典。请查询单词 "${word}" 并返回 JSON：
{
  "ipa": "国际音标",
  "cn": "中文翻译",
  "def_en": "英文释义（生物学语境）",
  "def_cn": "中文释义",
  "examples": ["例句1", "例句2"]
}
只返回 JSON，不要其他文字。`;

    const result = await callDeepSeek(
      [{ role: 'user', content: prompt }],
      { temperature: 0.1, response_format: { type: 'json_object' } }
    );

    return jsonResponse(JSON.parse(result));
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}
