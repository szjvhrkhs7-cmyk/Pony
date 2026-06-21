# Progress

## Phase 0 — Scaffold [DONE]
- Next.js + TypeScript + Tailwind initialized
- Prisma v7 + SQLite with full data model
- Seed script with Medieval Europe preset (5 countries, 16 regions, 11 points)
- DECISIONS.md created

## Phase 1 — Stub Game Loop [DONE]
- API routes: create game, load game, add action, time jump
- Stub simulation engine with deterministic responses
- Delta application logic (all 8 delta types)
- Zod schemas for simulation output validation
- Full game page with SVG map, action panel, time jump, event log, top bar

## Phase 2 — LLM Integration [DONE]
- Provider-independent LLM adapter (OpenAI, Anthropic, OpenRouter)
- 7 prompt categories with template variables
- Repair-retry loop for invalid JSON (3 attempts)
- Context builder assembles full game state into prompts
- Graceful fallback to stub engine on LLM failure

## Phase 3 — AI Communication [DONE]
- Diplomacy chat: bilateral conversations with AI nations
- Advisor panel: strategic guidance
- Brainstorm: action suggestion generation
- Polish: rewrite draft orders into precise commands

## Phase 4 — Map & UX [DONE]
- Interactive SVG map with clickable regions, tooltips, country info popover
- Point rendering: capitals (stars), cities (squares), battalions (markers)
- Player territory highlighted with dashed gold border
- Event viewer with step-by-step navigation
- Save/Load: games list, continue game, delete game

## Phase 5 — Long Game & Settings [DONE]
- Consolidation system: compresses old events into summaries (blocks of 5 rounds)
- Difficulty settings (very_easy through impossible) — affects LLM simulation prompts
- Settings panel with model selection, difficulty, consolidation trigger
- Context management: consolidated summaries + recent raw events fed to LLM
- All settings persist per game

## Remaining
- Phase 6 (Stretch): Preset editor, map editor, multiplayer, token tracking
