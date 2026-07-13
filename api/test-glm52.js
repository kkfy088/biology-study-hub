import { callGLMText, setCORS, json, MODELS } from './_lib.js';

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, { error: 'Method not allowed' }, 405);

  const startTime = Date.now();

  try {
    const { prompt, model } = req.body;
    const testPrompt = prompt || 'Explain the process of diffusion in biology in 3 sentences.';

    const result = await callGLMText(
      [{ role: 'user', content: testPrompt }],
      {
        model: model || MODELS.TEXT_ALT,
        max_tokens: 500,
        temperature: 0.3,
        reasoning_effort: 'medium',
      }
    );

    const elapsed = Date.now() - startTime;

    return json(res, {
      success: true,
      model: model || MODELS.TEXT_ALT,
      prompt: testPrompt,
      result,
      elapsed_ms: elapsed,
    });
  } catch (err) {
    const elapsed = Date.now() - startTime;
    return json(res, {
      success: false,
      model: MODELS.TEXT_ALT,
      error: err.message,
      elapsed_ms: elapsed,
    }, 500);
  }
}
