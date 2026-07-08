import { callDeepSeek, jsonResponse, CORS_HEADERS } from './_lib.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const { question, studentAnswer, correctAnswer, keyPoints } = await req.json();
    if (!question || !studentAnswer) return jsonResponse({ error: 'Missing fields' }, 400);

    const prompt = `你是一个严格的生物学阅卷老师。请评分以下主观题：

题目: ${question}
学生答案: ${studentAnswer}
参考答案: ${correctAnswer || '（无参考答案，请根据生物学知识判断）'}
得分要点: ${JSON.stringify(keyPoints || [])}

返回 JSON:
{
  "score": 0-10的整数,
  "feedback_cn": "中文反馈，指出对错和改进建议（100字以内）",
  "feedback_en": "英文反馈",
  "correct_points": ["答对的要点"],
  "missing_points": ["遗漏的要点"],
  "improvements": ["改进建议"]
}
评分标准：关键词命中=得分，逻辑正确=加分，概念错误=扣分。只返回 JSON。`;

    const result = await callDeepSeek(
      [{ role: 'user', content: prompt }],
      { model: 'deepseek-reasoner', temperature: 0.1, response_format: { type: 'json_object' } }
    );

    return jsonResponse(JSON.parse(result));
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}
