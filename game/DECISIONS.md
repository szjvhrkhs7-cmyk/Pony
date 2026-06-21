# Decisions

## Stack
- **Framework:** Next.js 15 (App Router) + TypeScript — as recommended in spec
- **UI:** Tailwind CSS — as recommended, shadcn/ui to be added in later phases
- **DB:** Prisma v7 + SQLite via better-sqlite3 adapter — zero config local dev
- **Map:** SVG render with custom polygon format (2D coordinates), not GeoJSON
- **LLM:** Stub engine for Phase 1, provider-independent adapter planned for Phase 2

## Data Model
- Game state is duplicated from Preset into GameRegion/GameCountry/GamePoint tables to allow mutations without affecting the template
- Relations stored as JSON strings (SQLite limitation), parsed at runtime
- Stats stored as JSON strings for flexibility

## Map Format
- Regions defined as arrays of [x, y] coordinate pairs forming closed polygons
- 2D coordinate space (0-800 x 0-500) for the initial preset
- SVG viewBox maps directly to this coordinate space

## Naming
- Project name: "Pax Alterna" — original name, no branding copied from original
