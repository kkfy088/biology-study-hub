import { getEmbedding, jsonResponse, CORS_HEADERS } from '../_lib.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const { chunks, source, unit } = await req.json();
    // chunks: [{ text, section, page }]
    if (!chunks || !Array.isArray(chunks) || chunks.length === 0) {
      return jsonResponse({ error: 'Missing chunks array' }, 400);
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return jsonResponse({ error: 'Supabase not configured' }, 500);
    }

    let indexed = 0;
    const errors = [];

    // Process chunks one by one (to stay within time limits)
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      try {
        // 1. Get embedding
        const embedding = await getEmbedding(chunk.text);

        // 2. Store in Supabase
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
        else errors.push(`Chunk ${i}: insert failed`);
      } catch (err) {
        errors.push(`Chunk ${i}: ${err.message}`);
      }
    }

    return jsonResponse({
      success: true,
      chunks_indexed: indexed,
      total: chunks.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}
