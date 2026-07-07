# Project Memory — ICMYP Biology Study Hub

## SOP (Standard Operating Procedure)
- **Location:** `.workbuddy/rules/SOP.md`
- **Current version:** v1.5 (updated 2026-07-06 — Edge-TTS neural voices via local proxy)
- **Update protocol:** When user says "update SOP", increment version, archive old version to `.workbuddy/rules/archive/`, mark old as DEPRECATED
- **Usage:** All future unit generation MUST follow the latest SOP version
- **Reference implementation:** `unit2.html` (v1.5 5-part + Edge-TTS voice selector). unit1.html retrofitted to v1.5 TTS engine.

## Project Structure
- `index.html` — Site homepage with unit directory (6 unit cards; Unit 1 & 2 active, 3-6 coming soon)
- `unit1.html` — Unit TS1: Classification of Living Organisms (v1.5 TTS retrofitted, legacy content architecture)
- `unit2.html` — Unit TS2: Cell Biology (v1.5 reference: 5-part study + mistake book + Edge-TTS voice selector)
- `tts_server.py` — Edge-TTS local proxy server (port 8766, free, no API key, cached)
- `start_tts.sh` — TTS launcher script (run before opening unit pages)
- `diagrams/` — Cropped textbook figures (13 fig1-13.png for Unit 1, 11 u2_fig01-11.png for Unit 2)
- `.workbuddy/rules/SOP.md` — Content generation SOP (ACTIVE, v1.5)
- `.workbuddy/rules/archive/` — Old SOP versions (v1.0–v1.4, DEPRECATED)

## Unit 2 Architecture (NEW — 5-part study system)
1. **Part 1 — Vocabulary cards**: ~46 terms with IPA + CN + EN def + textbook excerpt + figure. Categories: structure/organisation/transport/effect/method. Flag-to-mistake-book button.
2. **Part 2 — Matching quiz**: English definition → choose correct term (4 options). Auto-grading, reshuffle, wrong answers → mistake book.
3. **Part 3 — CN→EN recall**: Given Chinese, type the English term. Keyword/partial scoring (exact=100, partial=60).
4. **Part 4 — Cornell notes**: 4 sections (2.1/2.2/2.3/2.4), each with cue column (key points) + main reading passage + summary (EN+CN). Highlight + annotate feature → saves to mistake book.
5. **Part 5 — Cloze + Short answer**: 50/50 mix. Cloze = fill-in vocab term. Short = keyword-scored with model answer (EN+CN) + language notes.
6. **Mistake book**: localStorage-backed (`unit2_mistakebook_v1`). Tracks term, count, reasons, user answers, key points. Export to printable PDF (Cornell layout, A4, 9.5pt).

## Key Conventions
- Footer: "⚡ Powered by Michelle Yang · 2026"
- **TTS v1.5**: Edge-TTS (Microsoft neural, local proxy on port 8766) primary → StreamElements Polly → Web Speech fallback. Voice selector in nav bar (Jenny/Aria/Emma/Ana/Guy). Cache to `~/.cache/icmyp_tts/`. Run `./start_tts.sh` before opening pages. No API key, free.
- **Quiz querySelector scope rule (CRITICAL)**: 每个 Part 的 JS 函数查找 input/feedback 时必须用 part-specific scope (`#cn-en-quiz .cloze-input[data-qi=...]`, `#cloze-quiz .cloze-input[data-qi=...]`)，因为多个 part 复用 `.cloze-input` class + `data-qi` 数字索引会跨 part 冲突。
- **Debug 测试方案**: 系统 Chrome 147 headless (`--no-sandbox --remote-debugging-port=9222`) + Node ws 库 + CDP 协议。测试脚本 `/tmp/debug_unit2.cjs` + `/tmp/run_test.sh`。Skill 市场无 browser-automation skill 可用。
- Interactive quiz: 3 buttons (Submit / Show Answer / Retry) → feedback (3 panels) → answer log; answers always include EN + CN + Language Notes
- Bilingual: English primary, Chinese supplementary (.cn / .cn-soft)
- IGCSE 0610 syllabus alignment required for every unit
- Plant kingdom subgroups (1.3.5/1.3.6) excluded from course scope (confirmed by user)
- VOCAB data uses field `cat` (not `category`) for the category; renderers read `v.cat`
- Cloze items use `before/after/hint` fields (not `text_before/text_after/hint_en`)

## PDF Source Workflow (scanned textbook)
- Unit 2 source: `/Users/fy/Downloads/生物unit2.pdf` (22 pages, scanned, no text layer)
- Extraction: PyMuPDF render @200dpi → easyocr (CPU, ~3min/22pg) → `/tmp/unit2_ocr.txt`
- Figure cropping: OCR bbox gap analysis → PIL crop → `diagrams/u2_fig*.png`
- Vocabulary sources: Glossary pages (P19-22) + Key words pages (P6/9/12/16)
