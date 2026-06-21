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
- Prompt system with 7 categories: simulation, diplomacy, advisor, brainstorm, polish, consolidation, validation
- Template variables: ${PLAYER_COUNTRY}, ${CURRENT_DATE}, ${MAP_STATE}, etc.
- Repair-retry loop for invalid JSON (3 attempts + extraction)
- Context builder assembles full game state into prompt context
- Graceful fallback to stub engine on LLM failure

## Phase 3 — AI Communication [DONE]
- Diplomacy chat: bilateral conversations with AI nations (stub + LLM)
- Advisor panel: strategic guidance chat (stub + LLM)
- Brainstorm: action suggestion generation
- Polish: rewrite draft orders into precise commands
- All communication works in stub mode without API keys

## Phase 4 — Map & UX [DONE]
- Interactive SVG map with clickable regions, tooltips, country info popover
- Region stats display (economy, military, stability bars)
- Point rendering: capitals (stars), cities (squares), battalions (markers)
- Player territory highlighted with dashed gold border
- Event viewer with step-by-step "Next" navigation
- Event log with category icons
- Save/Load: games list, continue game, delete game
- Multiple UI panels: actions (bottom-right), diplomacy (bottom-right), advisor, time jump (top-right), event log (bottom-left)

## Remaining
- Phase 5: Consolidation + difficulty settings + prompt editor
- Phase 6: Stretch goals (preset editor, map editor, multiplayer)
