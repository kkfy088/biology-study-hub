import { getEmbedding, setCORS, json } from '../_lib.js';

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, { error: 'Method not allowed' }, 405);

  try {
    const { chunks, source, unit } = req.body;
    if (!chunks || !Array.isArray(chunks) || chunks.length === 0) {
      return json(res, { error: 'Missing chunks array' }, 400);
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return json(res, { error: 'Supabase not configured' }, 500);
    }

    let indexed = 0;
    const errors = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      try {
        const embedding = await getEmbedding(chunk.text);

        const insertResp = await fetch(`${supabaseUrl}/rest/v1/documents`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({
            unit: unit || 'supplement',
            section: chunk.section || null,
            page: chunk.page || null,
            chunk_index: i,
            content: chunk.text,
            content_cn: chunk.cn || null,
            source: source || 'upload',
            embedding,
          }),
        });

        if (insertResp.ok) indexed++;
        else {
          const errText = await insertResp.text();
          errors.push(`Chunk ${i}: insert failed (${insertResp.status}) ${errText.slice(0, 200)}`);
        }
      } catch (err) {
        errors.push(`Chunk ${i}: ${err.message}`);
      }
    }

    return json(res, {
      success: true,
      chunks_indexed: indexed,
      total: chunks.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    return json(res, { error: err.message }, 500);
  }
}
