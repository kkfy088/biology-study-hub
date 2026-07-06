# ICMYP Biology Study Hub — Content Generation SOP

> **Version: v1.2**
> **Created: 2026-06-28**
> **Updated: 2026-06-28** (TTS lock + Show Answer button)
> **Status: ACTIVE** (replaces v1.1)
> **Scope: All units of ICMYP Biology Study Hub**

---

## 📋 Overview

This SOP defines the standard prompt and workflow for generating any new unit page for the ICMYP Biology Study Hub website. Every new unit MUST follow this specification to ensure consistent quality, structure, and features across all units.

**Project location:** `/Users/fy/WorkBuddy/2026-06-28-17-44-53/`
**Existing files:**
- `index.html` — Site homepage with unit directory (update unit card status when new unit is added)
- `unit1.html` — Unit TS1 (reference implementation, copy its structure for new units)
- `diagrams/` — Cropped textbook figures
- `.workbuddy/rules/` — This SOP document (versioned)

---

## 🎯 Target Audience

- **Students:** Pre-IB first-tier international middle school students (初中生)
- **Language:** Primary English (full English content), with Chinese annotations as learning support
- **Exam standard:** Cambridge IGCSE Biology 0610 syllabus alignment

---

## 📐 Standard Unit Page Structure

Every unit page (`unitN.html`) MUST contain these sections in order:

### Section 1: Characteristics / Core Concepts
- Main topic introduction with mnemonic devices (like RINGER) where applicable
- Deep-dive cards for each sub-concept (color-coded: blue/green/purple/orange/red)
- Connection callout showing how concepts relate
- Historical/theoretical context callout

### Section 2: Classification / System Overview
- Why this topic matters (callout box with numbered reasons)
- Key tools/methods explained (e.g., dichotomous keys, DNA analysis)
- Traditional vs modern approaches comparison

### Section 3: Major Categories (e.g., Five Kingdoms)
- Comparison table with color-coded tags
- Important distinctions callout (⚠️ warning box)
- Quick decision tree / flowchart for identification

### Section 4: Hierarchy / Structure
- Visual hierarchy diagram (color-coded levels with arrows)
- Naming conventions (e.g., binomial nomenclature) with rules and examples
- Memory tricks (mnemonic devices)

### Section 5: Detailed Subcategories (e.g., Vertebrate Classes)
- Individual cards for each subcategory with emoji + key features list
- Comparison table across all subcategories
- Special adaptations callout

### Section 6: Edge Cases / Exceptions (e.g., Viruses)
- Critical fact callout (red/danger style)
- Structure breakdown cards
- Reproduction/process explanation
- Exam reminder callout

### Section 7: Vocabulary + Self-Quiz
- **Vocabulary grid** — 25-35 terms with English + Chinese annotations
- **Pronunciation tool tip** (blue info box)
- **Interactive self-quiz** — 7-10 questions with:
  - Answer input textarea (student types first)
  - Submit/Retry buttons
  - Bilingual model answer (English + Chinese)
  - Language Notes (vocabulary + grammar analysis)
  - Three-panel feedback (Good/Weak/Review)
  - Answer log at page bottom

### Section 8: Diagram-Based Study Module
- **Original textbook figures** cropped from source PDF (saved to `diagrams/`)
- Each figure paired with structured "explain aloud" training:
  - "When shown this diagram, you must be able to say..." (numbered list)
  - Common exam traps (⚠️ warning box)
  - Medical-school-style method: cover text → look at image → explain aloud → check
- **Self-test checklist** (12+ checkboxes, dark themed)

### Section 9: IGCSE Syllabus Gaps (if any)
- Cross-check against Cambridge IGCSE Biology 0610 syllabus
- Add missing specification points with clear "Gap" labels
- Each gap gets a dedicated card with definition + examples + exam tips

### Section 10: Syllabus Coverage Map
- Full table of all relevant IGCSE spec points for this topic
- Columns: Spec # | Specification Point | Status (✅ Full / ⚠️ Gap / ⊘ Not in Course) | Location in Guide
- Summary: "X/X in-scope spec points covered"

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
4. Anatomical/biological terms: add Chinese in `.cn-soft` style
5. Section titles and major concepts: use `.cn` highlighted tag
6. Vocabulary list: every entry has Chinese in `.cn-soft`

---

## 🔊 Pronunciation Widget Specification

### Auto-enhancement targets (must be present on every unit page):

1. **Vocabulary list items** (`.vocab-item`) — speak button after term
2. **RINGER/mnemonic items** (`.ringer-name`) — speak button after English word
3. **Card titles** (`.card-title`) — speak button after title
4. **Hierarchy levels** (`.h-level`) — speak button after level name
5. **Vertebrate/category card headers** (`.v-card h4`) — speak button
6. **Kingdom/category tags** (`.kingdom-tag`) — speak button
7. **Section titles** (`.section-title`) — speak button
8. **Inline text scanning** — TreeWalker scans all content areas (card-body, callout-body, quiz-q, answer-en, v-list li, td, li, p) and wraps known terms with inline speak buttons

### Features:
- **Click 🔊** → speaks the word using multi-provider TTS fallback chain:
- **Hover 🔊** → popup shows IPA phonetic + Chinese meaning
- **Inline terms** → dotted blue underline + small 🔊 button
- **Female voice** → multi-provider TTS fallback chain:
  1. **Google Translate TTS** (neural network, highest quality) — `translate.google.com/translate_tts`
  2. **StreamElements TTS** (Amazon Polly voice "Joanna", US female) — `api.streamelements.com`
  3. **Web Speech API** (browser built-in, female voice selection) — fallback
- Providers tried in order; if one fails (CORS/rate limit), automatically falls back to next
- **`ttsLocked` mechanism** — once ANY provider starts playing, a lock flag prevents other providers from also playing (prevents double voice). Lock is released by `stopAudio()` on next request.
- **`settled` flag** per provider — prevents same provider from resolving twice (canplaythrough + error race condition)

### Dictionaries:
- `PHONETICS` — IPA phonetics for 150+ biology terms (expand per unit)
- `CN_DICT` — Chinese definitions for 150+ biology terms (expand per unit)
- Terms sorted by length (longest first) for greedy regex matching
- `TERM_REGEX` built from all terms for text scanning

---

## ✍️ Interactive Quiz Engine Specification

### For each quiz question:

1. **Question display** — numbered, with hint
2. **Usage instructions** (top of quiz section) — blue info box explaining the 3 buttons and answer structure
3. **Answer input** — textarea (min-height 80px), placeholder in EN+中文
4. **Submit button** — "📤 Submit · 提交" (grades student answer + reveals model answer)
5. **Show Answer button** — "👁️ Show Answer · 直接查看答案" (reveals model answer WITHOUT requiring input — for when student just wants to study the answer)
6. **Reset button** — "🔄 Retry · 重做" (clears input + re-enables all buttons)
7. **Model answer** — hidden until submit or show-answer, contains:
   - English answer (`.answer-en`)
   - Chinese translation (`.answer-cn`)
   - Language Notes (`.lang-analysis`) with:
     - 🔑 Key Vocabulary (word | part of speech | definition + Chinese)
     - 📝 Grammar Points (pattern | explanation + Chinese)
8. **Feedback panel** — three columns (shown after Submit; after Show Answer shows reference note instead):
   - ✅ **Good Points** (green) — what student got right + score badge
   - ⚠️ **Needs Work** (red) — missing key points
   - 📚 **Review These** (blue) — concepts to study
9. **Answer log** (page bottom, dark themed) — tracks all attempts with score/time

### Quiz data structure (per question):
```javascript
{
  id: N,
  keywords: ['term1', 'term2', ...],        // all relevant terms
  essential: ['must-have1', 'must-have2'],   // critical points
  concepts: ['concept1', 'concept2'],        // study suggestions
  minKeywords: N                              // minimum terms for partial credit
}
```

### Scoring:
- Score = (essential keywords found / total essential) × 100%
- ≥80% = green badge "Excellent! 🌟"
- ≥50% = yellow badge "Good effort 👍"
- <50% = red badge "Needs review 📚"

### State management:
- In-memory only (resets on page reload)
- Track: attempts per question, total attempts, all scores, timestamps

---

## 🖼️ Diagram Extraction Rules

### From source PDF:
1. Convert PDF pages to PNG (150 dpi) using `pdftoppm`
2. Identify key diagrams/figures by reading page images
3. Crop figures using Pillow (PIL) with precise pixel coordinates
4. Save to `diagrams/` directory with descriptive names: `figN_description.png`
5. Target: 8-15 figures per unit

### For each figure in the study guide:
- Display image with border + shadow
- Title: "Figure N: [Description] [中文]"
- Source reference: "Textbook pX"
- Structured explanation block: "When shown this diagram, you must be able to say..."
- Numbered list of key points to explain
- Common exam traps warning box

---

## 📚 IGCSE Syllabus Verification Process

### For each new unit:
1. Fetch current Cambridge IGCSE Biology 0610 syllabus for the relevant topic
2. List ALL specification points (e.g., 1.1.1, 1.2.1, etc.)
3. Cross-check each point against generated content
4. Mark status:
   - ✅ **Full** — completely covered
   - ⚠️ **Gap** — under-covered, needs addition
   - ⊘ **Not in Course** — excluded per course scope
5. Add gap-filling content in Section 9
6. Build coverage map table in Section 10
7. State: "X/X in-scope spec points covered"

### Course scope notes:
- Some IGCSE spec points may be excluded from this specific course (e.g., plant kingdom subgroups were excluded from Unit 1)
- Always confirm with user before excluding spec points
- Mark excluded points as "⊘ Not in Course" with grey styling

---

## 🏗️ Site Integration

### When adding a new unit:

1. **Create `unitN.html`** — copy structure from `unit1.html`, replace content
2. **Update `index.html`:**
   - Change corresponding unit card from "🔜 Coming Soon" to "✅ Available"
   - Add `href="unitN.html"` link to the card
   - Remove `opacity:0.75;cursor:not-allowed;` styles
3. **Update stats strip** on homepage (Unit Live count, etc.)
4. **Update top nav** — add "Unit N →" link if needed
5. **Create `diagrams/` subfolder** or add to existing with unit-specific figures

### Navigation:
- Every unit page has a top nav bar with "← All Units" link back to `index.html`
- Homepage has unit cards that link to each `unitN.html`

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

### Color coding for cards:
- `.card-blue` — primary concepts (border-left: blue)
- `.card-green` — classification/systems
- `.card-purple` — hierarchy/naming
- `.card-orange` — growth/development
- `.card-red` — excretion/viruses/danger

---

## 📝 Language Analysis Specification

### For every quiz answer, include:

#### 🔑 Key Vocabulary (3-6 items per question):
- Format: `word | part of speech | definition (Chinese gloss)`
- Cover: domain-specific terms, academic verbs, connectors
- Chinese gloss explains nuance or etymology

#### 📝 Grammar Points (3-4 items per question):
- Format: `pattern name | English explanation (Chinese explanation)`
- Cover: tense, voice, relative clauses, conditionals, connectors, punctuation, academic writing patterns
- Include example from the answer text

### Grammar patterns to cover across a unit:
- Passive voice, relative clauses, conditionals (would/could)
- Concession (even though/although), comparison (more/most)
- Participle phrases (present/past as modifiers)
- Parallel structure, semicolon contrast, em-dash emphasis
- Latin abbreviations (e.g., i.e., etc.)
- Phrasal verbs (take in, rule out, depend on)
- Compound adjectives (land-dwelling, cold-blooded)

---

## ✅ Pre-Publication Checklist

Before marking a unit as complete, verify:

- [ ] All 10 sections present and populated
- [ ] Chinese annotations on all key terms (`.cn` and `.cn-soft`)
- [ ] 8-15 textbook figures extracted and embedded with explanations
- [ ] Pronunciation widget dictionaries updated with new unit's terms
- [ ] 7-10 quiz questions with keyword banks
- [ ] Every quiz answer has bilingual text + language analysis
- [ ] Interactive quiz engine functional (input → submit → feedback → log)
- [ ] IGCSE syllabus cross-checked, gaps filled, coverage map built
- [ ] Self-test checklist (12+ items) at end of diagram module
- [ ] Homepage `index.html` updated (unit card status + stats)
- [ ] Top nav bar present with "← All Units" link
- [ ] Footer: "⚡ Powered by Michelle Yang · 2026"
- [ ] Multi-provider TTS code present (Google → StreamElements Polly → Web Speech)
- [ ] `ttsLocked` mechanism present (prevents double voice)
- [ ] `settled` flag per provider (prevents double-resolve)
- [ ] Show Answer button present on every quiz question
- [ ] Quiz usage instructions (blue info box) at top of quiz section
- [ ] Print styles hide speak buttons
- [ ] Responsive design works on mobile

---

## 🔄 Version History

| Version | Date | Changes |
|---------|------|---------|
| **v1.0** | 2026-06-28 | Initial SOP. DEPRECATED — see archive/SOP_v1.0_2026-06-28.md. |
| **v1.1** | 2026-06-28 | TTS upgraded: multi-provider fallback chain. DEPRECATED — see archive/SOP_v1.1_2026-06-28.md. |
| **v1.2** | 2026-06-28 | TTS: added `ttsLocked` lock mechanism (prevents double voice) + `settled` flag. Quiz: added "Show Answer" button (view answer without input) + usage instructions box. Pre-publication checklist updated. |

---

## ⚠️ Update Protocol

When the user says "update the SOP" or "update the rules":
1. Increment version number (v1.0 → v1.1, or v2.0 for major changes)
2. Add entry to Version History table
3. Keep old versions in `/Users/fy/WorkBuddy/2026-06-28-17-44-53/.workbuddy/rules/archive/` with filename `SOP_vX.Y_YYYY-MM-DD.md`
4. Mark old version as "DEPRECATED" at top
5. The latest version in `rules/SOP.md` is always the ACTIVE version
6. All future unit generation MUST reference the latest version

---

## 📖 Reference Implementation

**Unit TS1** (`unit1.html`) is the gold-standard reference. When generating a new unit:
1. Open `unit1.html` as a template
2. Preserve all CSS (variables, card styles, quiz styles, pronunciation styles, feedback styles)
3. Preserve all JavaScript (pronunciation widget, quiz engine, voice selection)
4. Replace only the HTML content sections with new unit material
5. Update `PHONETICS` and `CN_DICT` dictionaries with new unit's terms
6. Update `QUIZ_DATA` array with new unit's questions and keyword banks

---

*This SOP ensures every unit of the ICMYP Biology Study Hub maintains consistent quality, structure, and pedagogical features. Follow it precisely for all future units.*
