# Progress

## Phase 0 — Scaffold [DONE]
- Next.js + TypeScript + Tailwind initialized
- Prisma v7 + SQLite with full data model (Preset, Game, Region, Country, Point, Event, Action, ChatThread, ChatMessage, ConsolidationSummary)
- Seed script with Medieval Europe preset (5 countries, 16 regions, 11 points)
- DECISIONS.md created

## Phase 1 — Stub Game Loop [DONE]
- API routes: POST /api/game (create), GET /api/game/[id] (load), POST /api/game/[id]/action, POST /api/game/[id]/jump
- Stub simulation engine with deterministic responses based on action keywords
- Delta application logic (region_owner_change, point_add/move/remove, relation_change, stat_change, country_add/remove)
- Zod schemas for simulation output validation
- Full game page: SVG map, action panel, time jump panel, event log, top bar
- Home page with preset/country selection
- Complete cycle: action -> jump -> events -> deltas applied -> map updated

## Remaining
- Phase 2: Real LLM integration
- Phase 3: Diplomacy chats + advisor
- Phase 4: Map interactivity + animations + save/load
- Phase 5: Consolidation + difficulty + prompt editor
- Phase 6: Stretch goals
