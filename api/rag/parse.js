import { callGLM, callDeepSeek, callVision, setCORS, json, MODELS } from '../_lib.js';

/**
 * R9 v2: Parse uploaded file with GLM-5V-Turbo vision → GLM-5.2 structure
 * Input: { image: base64, fileName, fileType }
 * Output: { vocabulary: [], cornell_sections: [], documents: [] }
 */
export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, { error: 'Method not allowed' }, 405);

  try {
    const { image, fileName } = req.body;
    if (!image) return json(res, { error: 'Missing image (base64)' }, 400);

    // Step 1: GLM-5V-Turbo vision recognition
    const visionResult = await callVision(image,
      `You are a biology textbook parser. Analyze this page from a biology study material.

Extract ALL text content you can see, preserving structure. Also describe any diagrams, tables, or figures.

Return in this exact format:
---TEXT START---
[All text content from the page, preserving paragraphs, headings, bullet points]
---TEXT END---

---FIGURES START---
[For each figure/diagram: description of what it shows, labels visible, and what concept it illustrates]
---FIGURES END---

---KEY TERMS START---
[List each key biological term found, one per line, with its definition if visible]
---KEY TERMS END---`,
      { max_tokens: 2000 }
    );

    // Step 2: GLM-5.2 — structure the recognized content into JSON
    const structureResult = await callGLM(
      [
        {
          role: 'system',
          content: `You are a biology content structurer. Given raw text from a textbook page, output STRICT JSON with this schema:

{
  "vocabulary": [
    {"term": "osmosis", "ipa": "/ɒzˈməʊsɪs/", "definition_en": "...", "definition_cn": "..."}
  ],
  "cornell_sections": [
    {
      "cue": {"Term EN 中文": "short explanation"},
      "main_text": "English paragraph summary of the content",
      "summary_en": "1-2 sentence summary",
      "summary_cn": "中文摘要"
    }
  ],
  "documents": [
    {"text": "A paragraph chunk for RAG (~200 words)", "section": "section identifier"}
  ]
}

Rules:
- vocabulary: only include actual biology terms with clear definitions
- cornell_sections: cue keys must be "English 中文" bilingual format
- main_text: English only, no Chinese
- documents: split into ~200 word chunks for vector search
- If a section is empty, use empty array []
- Output ONLY the JSON, no markdown code blocks`
        },
        {
          role: 'user',
          content: `File: ${fileName || 'unknown'}\n\nVision recognition result:\n\n${visionResult}`
        }
      ],
      { model: MODELS.TEXT, max_tokens: 2500, temperature: 0.1, thinking: false, response_format: { type: 'json_object' } }
    );

    // Parse the JSON
    let parsed;
    try {
      parsed = JSON.parse(structureResult);
    } catch (e) {
      const match = structureResult.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        throw new Error('Failed to parse structured output');
      }
    }

    return json(res, {
      success: true,
      raw_vision: visionResult.substring(0, 500) + '...',
      vocabulary: parsed.vocabulary || [],
      cornell_sections: parsed.cornell_sections || [],
      documents: parsed.documents || [],
    });

  } catch (err) {
    return json(res, { error: err.message }, 500);
  }
}
