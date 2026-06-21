# Pax Alterna

AI-powered alternative history sandbox. Write orders in free text, negotiate with AI nations, jump forward in time — and watch the world change.

## Quick Start

```bash
cd game
cp .env.example .env
npm install
npx prisma migrate dev
npx prisma generate
npx tsx prisma/seed.ts
npm run dev
```

Open http://localhost:3000

## Architecture

- **Frontend:** Next.js 15 (App Router) + TypeScript + Tailwind CSS
- **Map:** SVG renderer with custom 2D polygon format
- **Database:** Prisma v7 + SQLite (zero-config, portable)
- **Simulation:** Stub engine (Phase 1) / LLM-powered (Phase 2+)
- **Validation:** Zod schemas for all simulation output

## Game Loop

1. Select a preset and country
2. Write orders in free text (Actions panel)
3. Choose time interval and Jump Forward
4. Watch events unfold one by one
5. See map update with border changes, troop movements, stat changes
6. Repeat — state auto-saves each round

## Project Structure

```
src/
  app/
    api/
      presets/       — GET presets list
      game/          — POST create game
      game/[id]/     — GET game state
      game/[id]/action/ — POST add action
      game/[id]/jump/   — POST time jump
    game/[id]/       — Game page (map + UI)
    page.tsx         — Home (preset selection)
  components/
    GameMap.tsx       — SVG map renderer
    ActionPanel.tsx   — Free-text action input
    JumpPanel.tsx     — Time jump + event viewer
    TopBar.tsx        — Country info + date
    EventLog.tsx      — Event history
  lib/
    db.ts            — Prisma client
    schemas.ts       — Zod schemas for deltas
    engine/
      stub.ts        — Deterministic stub engine
      apply-deltas.ts — Delta application logic
prisma/
  schema.prisma      — Data model
  seed.ts            — Medieval Europe preset
```

## Data Model

Preset → Game (save) with GameRegions, GameCountries, GamePoints (mutable copies).
Events track what happened. Actions track player orders. Deltas are typed changes applied to state.

## Phases

See PROGRESS.md for current status and DECISIONS.md for architectural choices.
