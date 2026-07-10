import { callDeepSeek, getEmbedding, setCORS, json } from '../_lib.js';

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, { error: 'Method not allowed' }, 405);

  try {
    const { question, unit } = req.body;
    if (!question) return json(res, { error: 'Missing question' }, 400);

    // 1. Embed the question
    const queryEmbedding = await getEmbedding(question);

    // 2. Search Supabase pgvector
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    let matches = [];

    if (supabaseUrl && supabaseKey) {
      try {
        const rpcBody = {
          query_embedding: queryEmbedding,
          match_count: 5,
        };
        if (unit) rpcBody.filter_unit = unit;

        const searchResp = await fetch(`${supabaseUrl}/rest/v1/rpc/match_documents`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify(rpcBody),
        });

        if (searchResp.ok) {
          matches = await searchResp.json();
        }
      } catch (dbErr) {
        // Fall through to fallback
      }
    }

    // 3. If no matches, fallback to direct DeepSeek
    if (!matches || matches.length === 0) {
      const fallbackAnswer = await callDeepSeek([
        { role: 'system', content: '你是一个生物学老师，用中英双语回答学生的问题。术语用"英文（中文）"格式。' },
        { role: 'user', content: question }
      ], { temperature: 0.3 });

      return json(res, {
        answer: fallbackAnswer,
        sources: [],
        note: 'RAG 数据库为空或未配置，使用通用回答。导入课文数据后可启用精准检索。'
      });
    }

    // 4. Build context from matches
    const context = matches.map((m, i) =>
      `[${i + 1}] Unit: ${m.unit}, Section: ${m.section || 'N/A'}, Page: ${m.page || 'N/A'}\n${m.content}`
    ).join('\n\n');

    const sources = matches.map(m => ({
      unit: m.unit,
      section: m.section,
      page: m.page,
      text: m.content.slice(0, 150) + '...'
    }));

    // 5. Generate answer with DeepSeek
    const answer = await callDeepSeek([
      {
        role: 'system',
        content: `你是一个生物学老师。根据以下课文内容回答学生的问题。
要求：
- 用中英双语回答
- 术语用"英文（中文）"格式
- 引用来源时标注 [Unit X, Section Y]
- 如果课文内容不足以回答，说明并补充你的知识

课文内容：
${context}`
      },
      { role: 'user', content: question }
    ], { temperature: 0.3, max_tokens: 1000 });

    return json(res, { answer, sources });
  } catch (err) {
    return json(res, { error: err.message }, 500);
  }
}
