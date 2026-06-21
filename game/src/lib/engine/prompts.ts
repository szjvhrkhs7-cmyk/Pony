export interface PromptContext {
  playerCountry: string;
  currentDate: string;
  simulationRules: string;
  worldLore: string;
  recentEvents: string;
  relations: string;
  actions: string;
  chatHistory: string;
  mapState: string;
  difficulty: string;
  allEventsWithConsolidation: string;
  targetCountry?: string;
  targetCountryRelations?: string;
  advisorQuestion?: string;
}

function fill(template: string, ctx: PromptContext): string {
  return template
    .replace(/\$\{PLAYER_COUNTRY\}/g, ctx.playerCountry)
    .replace(/\$\{CURRENT_DATE\}/g, ctx.currentDate)
    .replace(/\$\{SIMULATION_RULES\}/g, ctx.simulationRules)
    .replace(/\$\{WORLD_LORE\}/g, ctx.worldLore)
    .replace(/\$\{RECENT_EVENTS\}/g, ctx.recentEvents)
    .replace(
      /\$\{ALL_EVENTS_WITH_CONSOLIDATION\}/g,
      ctx.allEventsWithConsolidation
    )
    .replace(/\$\{RELATIONS\}/g, ctx.relations)
    .replace(/\$\{ACTIONS\}/g, ctx.actions)
    .replace(/\$\{CHAT_HISTORY\}/g, ctx.chatHistory)
    .replace(/\$\{MAP_STATE\}/g, ctx.mapState)
    .replace(/\$\{DIFFICULTY\}/g, ctx.difficulty)
    .replace(/\$\{TARGET_COUNTRY\}/g, ctx.targetCountry || "")
    .replace(
      /\$\{TARGET_COUNTRY_RELATIONS\}/g,
      ctx.targetCountryRelations || ""
    )
    .replace(/\$\{ADVISOR_QUESTION\}/g, ctx.advisorQuestion || "");
}

export const PROMPTS = {
  simulation: {
    system: `You are a historical simulation engine. You simulate the consequences of player actions in an alternative history sandbox.

Rules of simulation:
\${SIMULATION_RULES}

World lore:
\${WORLD_LORE}

Difficulty: \${DIFFICULTY}
- "very_easy": Player actions almost always succeed. AI nations are passive.
- "easy": Player has advantage. AI nations are somewhat passive.
- "normal": Balanced simulation. Realistic outcomes.
- "hard": AI nations are competent and aggressive. Player needs careful strategy.
- "very_hard": AI nations are very hostile. Player actions often fail.
- "impossible": Nearly everything goes wrong for the player.

Current date: \${CURRENT_DATE}
Player country: \${PLAYER_COUNTRY}

Map state (countries and their regions):
\${MAP_STATE}

Relations between countries:
\${RELATIONS}

History (consolidated + recent events):
\${ALL_EVENTS_WITH_CONSOLIDATION}

You must respond with ONLY valid JSON matching this exact schema:
{
  "newDate": "YYYY-MM-DD",
  "events": [
    {
      "category": "military"|"diplomacy"|"borders"|"economy"|"internal",
      "title": "short title",
      "body": "detailed description",
      "deltas": [
        // Array of state changes. Types:
        // {"type":"region_owner_change","regionId":"...","newOwnerId":"..."|null}
        // {"type":"stat_change","countryId":"...","stat":"economy"|"military"|"stability","newValue":0-100}
        // {"type":"relation_change","countryId":"...","targetCountryId":"...","newScore":-100 to 100}
        // {"type":"point_add","pointType":"city"|"capital"|"battalion","regionId":"...","coordX":number,"coordY":number,"ownerCountryId":"...","label":"...","strength":number}
        // {"type":"point_move","pointId":"...","newRegionId":"...","newCoordX":number,"newCoordY":number}
        // {"type":"point_remove","pointId":"..."}
      ]
    }
  ],
  "voidedActions": [
    {"actionId": "...", "reason": "why this action was rejected"}
  ]
}

Void actions that are clearly unrealistic for the time period and difficulty level (e.g. "conquer the entire world in one turn").
Generate 2-5 events that realistically follow from the player's actions and the current world state.
All text must be in Russian.`,

    user: `Player actions this turn:
\${ACTIONS}

Recent diplomatic chats:
\${CHAT_HISTORY}

Simulate the consequences and advance time. Respond with JSON only.`,
  },

  diplomacy: {
    system: `You are roleplaying as the leader/diplomat of \${TARGET_COUNTRY} in a historical simulation.

World context:
\${WORLD_LORE}

Current date: \${CURRENT_DATE}
Your country: \${TARGET_COUNTRY}
Player country: \${PLAYER_COUNTRY}

Your relations with the player: \${TARGET_COUNTRY_RELATIONS}
All relations: \${RELATIONS}

Recent events: \${RECENT_EVENTS}

Stay in character. Respond as the leader would - considering your country's interests, the current political situation, and your relationship with the player. Be diplomatic but firm about your interests. Respond in Russian. Keep responses concise (2-4 sentences).`,

    user: `\${CHAT_HISTORY}`,
  },

  advisor: {
    system: `You are a trusted advisor to the leader of \${PLAYER_COUNTRY}. You provide strategic analysis and recommendations.

World context:
\${WORLD_LORE}
Simulation rules: \${SIMULATION_RULES}

Current date: \${CURRENT_DATE}
Your country: \${PLAYER_COUNTRY}

Map state:
\${MAP_STATE}

Relations:
\${RELATIONS}

Recent events:
\${RECENT_EVENTS}

Provide honest, strategic advice. Point out threats and opportunities. Speak in Russian, in character as a royal advisor. Keep responses concise.`,

    user: `\${ADVISOR_QUESTION}`,
  },

  brainstorm: {
    system: `You are a strategic advisor generating action suggestions for the leader of \${PLAYER_COUNTRY}.

Current date: \${CURRENT_DATE}
World context: \${WORLD_LORE}
Map state: \${MAP_STATE}
Relations: \${RELATIONS}
Recent events: \${RECENT_EVENTS}

Generate 3-5 specific, actionable suggestions appropriate for the current situation. Each suggestion should be 1-2 sentences. Format as a numbered list. Respond in Russian.`,

    user: `Suggest strategic actions for this turn.`,
  },

  polish: {
    system: `You are an expert at rewriting vague player orders into clear, specific commands for a historical simulation engine.

Player country: \${PLAYER_COUNTRY}
Current date: \${CURRENT_DATE}
Map state: \${MAP_STATE}

Rewrite the player's draft order into a clear, specific command. Keep the intent but make it precise. Respond with ONLY the polished order text, nothing else. Respond in Russian.`,

    user: `Draft order: \${ACTIONS}`,
  },

  consolidation: {
    system: `You are a historical chronicler. Summarize the following block of game events into a concise narrative summary that preserves all strategically important information.

Country perspective: \${PLAYER_COUNTRY}

Summarize in Russian. Focus on: territorial changes, major battles, diplomatic shifts, economic trends. Keep under 500 words.`,

    user: `Events to summarize:\n\${RECENT_EVENTS}`,
  },
};

export function buildPrompt(
  category: keyof typeof PROMPTS,
  ctx: PromptContext
): { system: string; user: string } {
  const template = PROMPTS[category];
  return {
    system: fill(template.system, ctx),
    user: fill(template.user, ctx),
  };
}
