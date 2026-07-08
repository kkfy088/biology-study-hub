# ICMYP Biology Study Hub — Content Generation SOP

> **Version: v1.5**
> **Created: 2026-06-28**
> **Updated: 2026-07-06** (TTS upgraded to Edge-TTS neural voices via local proxy)
> **Status: ACTIVE** (replaces v1.4)
> **Scope: All units of ICMYP Biology Study Hub**

---

## 📋 Overview

This SOP defines the standard prompt and workflow for generating any new unit page for the ICMYP Biology Study Hub website. Every new unit MUST follow this specification to ensure consistent quality, structure, and features across all units.

**Project location:** `michelle-learn-biology/`
**Existing files:**
- `index.html` — Site homepage with unit directory (update unit card status when new unit is added)
- `unit1.html` — Unit TS1 (v1.5 TTS engine retrofitted)
- `unit2.html` — Unit TS2 **(CURRENT REFERENCE — 5-part architecture + mistake book + Edge-TTS voice selector)**
- `tts_server.py` — Edge-TTS local proxy server (port 8766)
- `start_tts.sh` — TTS server launcher
- `diagrams/` — Cropped textbook figures (prefixed: `fig*.png` for U1, `u2_fig*.png` for U2)
- `docs/` — This SOP document (versioned)

**⚠️ Before opening any unit page, run:** `./start_tts.sh` (one-time, then leave running in background)

---

## 🎯 Target Audience

- **Students:** Pre-IB first-tier international middle school students (初中生)
- **Language:** Primary English (full English content), with Chinese annotations as learning support
- **Exam standard:** Cambridge IGCSE Biology 0610 syllabus alignment
- **Learning goal:** First-pass mastery — vocabulary → recognition → recall → reading comprehension → application, all tracked

---

## 🏗️ STANDARD UNIT ARCHITECTURE (v1.4 — 5-Part Study System)

**Every new unit (`unitN.html`) MUST implement all 5 parts + mistake book.** This is the v1.4 standard, first implemented in `unit2.html`. The 5 parts form a deliberate learning ladder: **learn → recognize → recall → comprehend → apply**.

### Part 1 — Vocabulary Cards (`#vocab-grid`)
- **Count:** 40-55 terms per unit (derived from PDF Glossary pages + Key words pages + textbook bold terms)
- **Each card fields:** `term`, `ipa` (IPA phonetic), `cn` (Chinese), `def_en` (full English definition), `excerpt` (1-2 sentence textbook quote), `fig` (optional figure filename), `cat` (category)
- **Categories (color-coded):** 5 categories per unit, mapped to the unit's sub-topics. Example from Unit 2: `structure` / `organisation` / `transport` / `effect` / `method`
- **Card UI:** term + 🔊 speaker + IPA pill + category tag + CN + EN definition + excerpt + optional figure + 🚩 "加入生词本" flag button
- **Flag button:** adds term to mistake book (manual marking for review)

### Part 2 — Matching Quiz (`#matching-quiz`)
- **Mechanic:** English definition shown → student selects the correct term from 4 options
- **Pool:** all VOCAB terms (`MATCH_POOL = VOCAB.map(...)`)
- **Per session:** pick 20 questions randomly (shuffled), 4 options each (1 correct + 3 random distractors)
- **Controls:** "✓ Submit All" (grades everything) + "🔄 重新出题 Reshuffle" (new random set) + live score counter
- **Grading:** instant color reveal (green = correct, red = wrong), correct answer always shown
- **Wrong answers → mistake book** automatically (records the confusion pair)

### Part 3 — CN → EN Recall (`#cn-en-quiz`)
- **Mechanic:** Chinese definition shown → student TYPES the English term
- **Pool:** all VOCAB terms (`CN_EN_POOL`)
- **Scoring:** exact match = 100%, partial (contains + length ≥ 4) = 60%, else 0%
- **Controls per question:** "✓ Submit" + "🔄 Retry" + "👁️ Show Answer" + live score
- **Feedback:** 3-panel (Strengths / Gaps / Study) + reference answer with textbook sentence
- **Wrong answers → mistake book** automatically

### Part 4 — Cornell Notes Reading (`#cornell-container`)
- **Layout:** true Cornell format — cue column (left, ~30%) + main reading passage (right, ~70%) + summary bar (bottom, EN + CN)
- **Sections:** 4 per unit, aligned to textbook chapter sub-sections (e.g., 2.1 / 2.2 / 2.3 / 2.4)
- **Cue column:** key memory points as `{term: explanation}` pairs — rendered as definition list
- **Main passage:** full English textbook-style prose (3-5 paragraphs), with all VOCAB terms auto-enhanced with inline 🔊 speakers via `walkAndEnhance()`
- **Summary:** 1-2 sentence EN summary + 1-2 sentence CN summary
- **Highlight feature:** student selects text → "📌 Save highlight + note" button → prompt for note → wraps in `<mark>` + saves to mistake book
- **Goal:** barrier-free reading of original-style textbook English, with lookup + annotation support

### Part 5 — Cloze + Short Answer (`#cloze-quiz`)
- **Mix:** 50% cloze (fill-in) + 50% short-answer (subjective). Target ~24 cloze + ~6 short per unit.
- **Cloze items** `{type:'cloze', before, answer, after, hint}`:
  - `before` / `after`: the sentence with the blank
  - `answer`: MUST be a VOCAB term (so speaker + lang-notes work)
  - `hint`: short EN clue
  - Grading: exact or partial match → 100% or 0%
- **Short items** `{type:'short', q_en, q_cn, keywords[], model_en, model_cn, lang_notes}`:
  - `keywords`: essential terms the answer must contain (6-10)
  - `model_en` / `model_cn`: full bilingual model answer
  - `lang_notes`: written-English grammar + vocabulary guidance (how to SAY it, WHY say it that way)
  - Grading: (keywords hit / total) × 100%
- **Controls per question:** "✓ Submit" + "🔄 Retry" + "👁️ Show Answer"
- **Feedback:** score badge + 3-panel (Good / Missing keywords / Study) + model answer block (EN + CN) + language notes
- **Score < 80% → mistake book** automatically

### Part 6 — Mistake Book (错题本) — THE UNIFYING SYSTEM
- **Storage:** `localStorage`, key = `unitN_mistakebook_v1`
- **Structure:** `{ items: { term_lowercase: { term, category, cn, count, firstWrong, lastWrong, reasons[], prompts[], userAnswers[], keys_en[], keys_cn[] } } }`
- **Aggregation:** same term wrong multiple times → `count` increments, reasons/userAnswers accumulate (max 3 each), deduplicated
- **Sources (all 5 parts feed into it):**
  - Part 1: manual flag (🚩)
  - Part 2: wrong matching choice
  - Part 3: wrong/spelled term
  - Part 4: highlighted passage + note
  - Part 5: wrong cloze / low-score short answer
- **UI:** live-rendered list, each item shows term + CN + category color + wrong-count badge + reasons + key points. Clear-all button.
- **PDF Export:** "📥 导出背诵纸 PDF" button → generates a new window with Cornell-layout printable HTML (A4, 9.5pt, save-ink) → browser print-to-PDF. Layout: cue column (term + CN + count) + main column (why-wrong + key EN/CN points). Header: unit title + date + "⚡ Powered by Michelle Yang · 2026".

### Part 7 — Syllabus Coverage Map (`#syllabus-body`)
- Table of all relevant IGCSE 0610 spec points for this topic
- Columns: Spec Code | Description | Covered (✓)
- Summary line: "X / X spec points addressed · IGCSE 0610 Topic N"

---

## 📐 Page Layout (Top-to-Bottom)

1. **Top nav bar** — "← All Units" link + unit title + "🔬 Cell Biology" subtitle
2. **Unit hero** — title (EN + CN) + brief description + learning-objectives list
3. **Part 1: Vocabulary** — section header + vocab grid (cards)
4. **Part 2: Matching Quiz** — section header + quiz toolbar + questions
5. **Part 3: CN → EN Recall** — section header + quiz grid
6. **Part 4: Cornell Notes** — section header + 4 Cornell blocks
7. **Part 5: Cloze + Short Answer** — section header + mixed quiz
8. **Part 7: Syllabus Map** — section header + coverage table
9. **Part 6: Mistake Book** — section header + mistake list + export button (placed near bottom so it's always reachable after doing the exercises)
10. **Footer** — "⚡ Powered by Michelle Yang · 2026"

---

## 🌐 Bilingual Annotation Rules

### Two visual styles for Chinese annotations:

| Style | CSS Class | Usage | Example |
|-------|-----------|-------|---------|
| **Highlighted tag** | `.cn` | Core concept titles, section headers | Respiration **呼吸作用** (orange background pill) |
| **Soft inline** | `.cn-soft` | Term explanations, parenthetical notes | gills（鳃）, feathers（羽毛） |

### Rules:
1. English is ALWAYS primary content
2. Chinese is supplementary — for understanding, not replacement
3. Every key scientific term gets a Chinese annotation
4. Vocabulary cards: `cn` field is mandatory
5. Cornell summaries: always provide BOTH EN and CN
6. Short-answer model answers: always provide BOTH `model_en` and `model_cn`

---

## 🔊 Pronunciation Widget Specification

### Auto-enhancement targets (must be present on every unit page):

1. **Vocabulary card terms** (`.vocab-term`) — speak button after term
2. **Cornell reading passages** — inline term scanning via `walkAndEnhance()` wraps all VOCAB terms with 🔊
3. **Any content area** (`.card-body, .callout-body, .cornell-main`) — TreeWalker scans and enhances

### Features:
- **Click 🔊** → speaks the word using multi-provider TTS fallback chain
- **Hover 🔊** → popup shows IPA phonetic + Chinese meaning
- **Inline terms** → dotted blue underline + small 🔊 button

### Multi-provider TTS fallback chain (v1.5 — Edge-TTS primary):
1. **Edge-TTS local proxy** (Microsoft neural network, **primary**) — `http://127.0.0.1:8766/tts`
   - Voice map: `jenny` (en-US-JennyNeural, warm, default) · `aria` (en-US-AriaNeural, crisp) · `emma` (en-GB-EmmaNeural, UK) · `ana` (en-US-AnaNeural, younger) · `guy` (male)
   - **Free, no API key, no rate limit.** Caches all audio to `~/.cache/icmyp_tts/` for instant replay.
   - Launched via `./start_tts.sh` (nohup background, port 8766)
   - Probe at page load: `fetch('http://127.0.0.1:8766/health')` → sets `TTS_PROXY_ONLINE`
   - If proxy down, automatically skipped on subsequent requests
2. **StreamElements TTS** (Amazon Polly voice "Joanna", US female) — `api.streamelements.com`
3. **Web Speech API** (browser built-in, female voice selection) — fallback

### Critical infrastructure files:
- `tts_server.py` — Edge-TTS proxy server (aiohttp + edge-tts library)
- `start_tts.sh` — launcher script (check, start, health-verify)
- Cache dir: `~/.cache/icmyp_tts/` (auto-created, md5-hash filenames)

### HTML-side integration:
- `TTS_PROXY` constant: `'http://127.0.0.1:8766/tts'`
- `TTS_VOICE` variable: defaults to `'jenny'`, user-selectable via dropdown in nav bar (`#voice-select`)
- Voice preference saved to `localStorage` key `'icmyp_tts_voice'`
- Provider chain: `speakEdgeTTS()` → `speakStreamElements()` → `speakWebSpeech()`
- `TTS_PROXY_ONLINE` flag — set false on first error/timeout, skips Edge for rest of session

### Legacy notes (DEPRECATED in v1.5):
- Google Translate TTS (`translate.google.com/translate_tts`) — removed: low quality, frequent CORS blocks
- Old "race" pattern (Web Speech starts in 50ms, cloud races to upgrade) — removed: caused double voice artifacts

### Dictionaries (auto-built from VOCAB array in v1.4):
```javascript
VOCAB.forEach(function(v){
  PHONETICS[v.term.toLowerCase()] = v.ipa;
  CN_DICT[v.term.toLowerCase()]   = v.cn;
  TERM_LIST.push(v.term);
});
// TERM_REGEX built from all terms, longest-first for greedy multi-word matching
```

---

## ✍️ Quiz Engine Specifications (v1.4 — 3 quiz types)

### Type A: Matching Quiz (Part 2)
- Radio-button selection (4 options)
- Submit-all-then-grade (one submit button for whole set)
- Reshuffle regenerates the question set
- Wrong → mistake book with confusion pair recorded

### Type B: CN → EN Recall (Part 3)
- Text input per question
- Per-question submit (instant feedback)
- `normalizeAnswer()`: lowercase + strip punctuation + collapse spaces
- Scoring: exact = 100%, partial (contains + len ≥ 4) = 60%
- Show Answer button reveals the term without requiring input

### Type C: Cloze + Short Answer (Part 5)
- Mixed pool, shuffled on render
- Cloze: text input, exact/partial match scoring
- Short: textarea, keyword-ratio scoring
- Both: 3-button control (Submit / Retry / Show Answer)
- Short answers MUST include `lang_notes` — written-English guidance (how to phrase it, why)

### Common to all:
- 3-panel feedback: ✓ Strengths (green) / ✗ Gaps (red) / 📖 Study (blue)
- Score badge: ≥80% green, ≥50% yellow, <50% red
- Every answer block includes EN + CN
- Wrong/low-score → mistake book

---

## 🖼️ Diagram / Figure Extraction Rules

### From source PDF (scanned textbook workflow):
1. **Render** PDF pages to PNG at 200 dpi using PyMuPDF (`fitz`)
2. **OCR** all pages using `easyocr` (CPU mode, `['en']`, paragraph mode) → save to `/tmp/unitN_ocr.txt`
3. **Identify figures** via OCR text-gap analysis: large vertical bands with no text = image regions
4. **Crop** figures using Pillow (PIL) with coordinates from gap analysis → save to `diagrams/uN_figNN_description.png`
5. **Target:** 8-15 figures per unit
6. **Naming:** `u{N}_fig{NN}_{short_description}.png` (zero-padded)

### Figure usage in content:
- Vocabulary cards: `fig` field references the file (shown inline in card)
- Cornell notes: referenced in cue column or embedded in passage
- Each figure has a caption (term or description)

---

## 📚 IGCSE Syllabus Verification Process

### For each new unit:
1. Identify the relevant IGCSE 0610 topic number(s)
2. List ALL specification points (e.g., 2.1, 2.2.1, 3.4, etc.)
3. Cross-check each point against the 5-part content
4. Mark status: ✅ Full (covered) — add to syllabus table
5. Build coverage map table in Part 7
6. State: "X / X spec points addressed"
7. If a spec point is excluded per course scope, confirm with user first

---

## 🏗️ Site Integration

### When adding a new unit:

1. **Create `unitN.html`** — use `unit2.html` as the template (v1.4 5-part architecture)
2. **Update `index.html`:**
   - Change corresponding unit card from "🔜 Coming Soon" to "✓ Available"
   - Wrap card in `<a href="unitN.html">` (remove `cursor:not-allowed`)
   - Update card title + description
3. **Create figures** in `diagrams/` with `u{N}_` prefix
4. **Test:** run local server, verify HTTP 200, verify all data pools load (console.log counts)

### Navigation:
- Every unit page has a top nav bar with "← All Units" link back to `index.html`
- Homepage unit cards link to each `unitN.html`

---

## 🎨 Design System (CSS Variables)

```css
--bg: #fafbfc;
--card-bg: #ffffff;
--primary: #2563eb;        /* Blue — main accent */
--accent: #059669;         /* Green — success/correct */
--warning: #f59e0b;        /* Orange — warnings/tips */
--danger: #ef4444;         /* Red — errors/critical */
--purple: #7c3aed;         /* Purple — special topics */
--text: #1e293b;
--text-secondary: #64748b;
--border: #e2e8f0;
--radius: 14px;
--radius-sm: 8px;
```

### Category color classes (vocab cards + mistake items):
- `.cat-structure` / `.cat-tag-structure` — primary blue
- `.cat-organisation` / `.cat-tag-organisation` — accent green
- `.cat-transport` / `.cat-tag-transport` — purple
- `.cat-effect` / `.cat-tag-effect` — danger red
- `.cat-method` / `.cat-tag-method` — warning orange
- (Define new category classes per unit as needed, following this pattern)

### Cornell layout CSS:
- `.cornell-block` — flex container
- `.cornell-cue` — left column, ~30% width, tinted background
- `.cornell-main` — right column, ~70% width, reading passage
- `.cornell-summary` — bottom bar, EN + CN
- `.cue-list dt/dd` — definition list styling for cue points

---

## 📝 Language Analysis Specification (Short Answers)

### For every short-answer question, `lang_notes` MUST include:

- **Key structure words** — the domain terms the answer needs (bolded), with CN gloss
- **Causal connectors** — because, so, therefore, as a result, due to
- **Sentence frames** — "X is the … of … from … to …" (definitions), "by: (1) …; (2) …; (3) …" (lists)
- **Comparison language** — whereas, while, by contrast, unlike, similar to
- **Process narration tense** — present simple for biological processes
- **Direction words** — into / out of / across / through / down (a gradient)

### Bilingual principle:
- `model_en` = full English answer (exam-ready)
- `model_cn` = faithful Chinese translation (for understanding)
- `lang_notes` = explains HOW to write it in English and WHY (grammar + word choice), written bilingually

---

## ✅ Pre-Publication Checklist (v1.4)

Before marking a unit as complete, verify:

### Content:
- [ ] Part 1: 40-55 vocabulary cards with IPA + CN + EN def + excerpt + category
- [ ] Part 2: matching quiz pool = all VOCAB terms, 4-option MCQ working
- [ ] Part 3: CN→EN recall pool = all VOCAB terms, partial scoring working
- [ ] Part 4: 4 Cornell sections (cue + main + summary), highlight feature working
- [ ] Part 5: ~24 cloze + ~6 short answer, keyword scoring + lang_notes present
- [ ] Part 6: mistake book receiving from all 5 parts, PDF export generating
- [ ] Part 7: syllabus coverage table with X/X summary

### Technical:
- [ ] All VOCAB `cat` field values have matching CSS classes
- [ ] Cloze answers reference VOCAB terms where possible (for speaker)
- [ ] `PHONETICS` / `CN_DICT` / `TERM_LIST` / `TERM_REGEX` auto-built from VOCAB
- [ ] Multi-provider TTS (Google → StreamElements → Web Speech) + `ttsLocked`
- [ ] Offline detection (navigator.onLine) for instant Web Speech fallback
- [ ] `walkAndEnhance()` runs on Cornell main passages + card bodies
- [ ] localStorage key unique per unit (`unitN_mistakebook_v1`)
- [ ] PDF export HTML is self-contained (inline CSS, A4, print-optimized)

### Integration:
- [ ] `index.html` unit card flipped to Available + linked
- [ ] Top nav "← All Units" present
- [ ] Footer: "⚡ Powered by Michelle Yang · 2026"
- [ ] Local server smoke-test: HTTP 200 on unit page + index + sample diagram
- [ ] Console shows data-pool counts with no errors

---

## 🔄 Version History

| Version | Date | Changes |
|---------|------|---------|
| **v1.0** | 2026-06-28 | Initial SOP. DEPRECATED — see archive/SOP_v1.0_2026-06-28.md. |
| **v1.1** | 2026-06-28 | TTS upgraded: multi-provider fallback chain. DEPRECATED — see archive/SOP_v1.1_2026-06-28.md. |
| **v1.2** | 2026-06-28 | TTS: `ttsLocked` lock + `settled` flag. Quiz: "Show Answer" button + usage instructions. DEPRECATED — see archive/SOP_v1.2_2026-06-28.md. |
| **v1.3** | 2026-06-29 | TTS: instant playback + offline Web Speech fallback. GitHub Pages deployment documented. DEPRECATED — see archive/SOP_v1.3_2026-06-29.md. |
| **v1.4** | 2026-07-06 | **MAJOR: 5-part study architecture** (vocab → matching → CN→EN recall → Cornell reading → cloze+short). Added unified **mistake book** (localStorage, aggregates from all 5 parts). Added **Cornell notes** layout with highlight+annotate. Added **PDF export** (printable背诵纸, A4 Cornell layout). Standardized scanned-PDF workflow (PyMuPDF + easyocr). Reference implementation: `unit2.html`. DEPRECATED — see archive/SOP_v1.4_2026-07-06.md. |
| **v1.5** | 2026-07-06 | **TTS upgraded to Edge-TTS** (Microsoft neural voices via local proxy on port 8766). Free, no API key, no rate limit. Voice selector dropdown added to nav bar (Jenny/Aria/Emma/Ana). Cache to ~/.cache/icmyp_tts/. Google Translate TTS removed (low quality). Old "race" pattern removed. Added `tts_server.py` + `start_tts.sh`. |

---

## ⚠️ Update Protocol

When the user says "update the SOP" or "update the rules":
1. Increment version number (v1.4 → v1.5 for minor, v2.0 for major)
2. Copy current SOP to `archive/SOP_vX.Y_YYYY-MM-DD.md`
3. Mark archived version as "DEPRECATED" at top
4. Update Version History table in the new version
5. The latest version in `rules/SOP.md` is always the ACTIVE version
6. All future unit generation MUST reference the latest version

---

## 📖 Reference Implementation

**Unit TS2** (`unit2.html`) is the **current gold-standard reference** for the v1.4 5-part architecture. When generating a new unit:
1. Open `unit2.html` as a template
2. Preserve all CSS (variables, card styles, quiz styles, Cornell styles, mistake-book styles, feedback styles)
3. Preserve all JavaScript (TTS engine, term-scanning `walkAndEnhance`, 3 quiz engines, mistake book, PDF export)
4. Replace the DATA LAYER only: `VOCAB`, `MATCH_POOL` (auto), `CN_EN_POOL` (auto), `CORNELL_SECTIONS`, `CLOZE_POOL`, `SHORT_POOL`
5. Update syllabus spec table in `renderSyllabus()`
6. Update localStorage key to `unitN_mistakebook_v1`

**Unit TS1** (`unit1.html`) uses the older single-quiz architecture — kept for reference but NOT the template for new units.

---

*This SOP ensures every unit of the ICMYP Biology Study Hub maintains consistent quality, structure, and pedagogical features. Follow it precisely for all future units.*
