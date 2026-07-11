import { callVision, setCORS, json } from './_lib.js';

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, { error: 'Method not allowed' }, 405);

  try {
    const { image, prompt } = req.body;
    if (!image) return json(res, { error: 'Missing image' }, 400);

    const textPrompt = prompt || 'Describe this biology diagram in detail: 1) What structure or process does it show? 2) Label the key parts and their functions. 3) What are the common exam points? Use clear English.';

    let lastErr;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await callVision(image, textPrompt, { max_tokens: 1000 });
        return json(res, { description: result });
      } catch (err) {
        lastErr = err;
        if (err.message.includes('1305') || err.message.includes('429')) {
          await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
          continue;
        }
        throw err;
      }
    }
    return json(res, { error: 'GLM vision model is busy right now. Please try again in a moment. (Rate limited)' }, 429);
  } catch (err) {
    return json(res, { error: err.message }, 500);
  }
}
