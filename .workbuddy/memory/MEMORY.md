# Project Memory — ICMYP Biology Study Hub

## SOP (Standard Operating Procedure)
- **Location:** `.workbuddy/rules/SOP.md`
- **Current version:** v1.2 (updated 2026-06-28 — TTS lock + Show Answer button)
- **Update protocol:** When user says "update SOP", increment version, archive old version to `.workbuddy/rules/archive/`, mark old as DEPRECATED
- **Usage:** All future unit generation MUST follow the latest SOP version

## Project Structure
- `index.html` — Site homepage with unit directory (6 unit cards)
- `unit1.html` — Unit TS1: Classification of Living Organisms (reference implementation)
- `diagrams/` — Cropped textbook figures (13 figures for Unit 1)
- `.workbuddy/rules/SOP.md` — Content generation SOP (ACTIVE, v1.2)
- `.workbuddy/rules/archive/` — Old SOP versions (v1.0, v1.1 — DEPRECATED)

## Key Conventions
- Footer: "⚡ Powered by Michelle Yang · 2026"
- TTS: multi-provider fallback (Google Translate TTS → StreamElements Amazon Polly Joanna → Web Speech API) + `ttsLocked` mechanism prevents double voice
- Interactive quiz: 3 buttons (Submit / Show Answer / Retry) → feedback (3 panels) → answer log; answers always include EN + CN + Language Notes
- Bilingual: English primary, Chinese supplementary (.cn / .cn-soft)
- IGCSE 0610 syllabus alignment required for every unit
- Plant kingdom subgroups (1.3.5/1.3.6) excluded from course scope (confirmed by user)
