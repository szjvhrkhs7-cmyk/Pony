import { z } from "zod";

export const DeltaSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("region_owner_change"),
    regionId: z.string(),
    newOwnerId: z.string().nullable(),
  }),
  z.object({
    type: z.literal("point_add"),
    pointType: z.enum(["city", "capital", "battalion"]),
    regionId: z.string(),
    coordX: z.number(),
    coordY: z.number(),
    ownerCountryId: z.string(),
    label: z.string(),
    strength: z.number().optional().default(0),
  }),
  z.object({
    type: z.literal("point_move"),
    pointId: z.string(),
    newRegionId: z.string(),
    newCoordX: z.number(),
    newCoordY: z.number(),
  }),
  z.object({
    type: z.literal("point_remove"),
    pointId: z.string(),
  }),
  z.object({
    type: z.literal("relation_change"),
    countryId: z.string(),
    targetCountryId: z.string(),
    newScore: z.number().min(-100).max(100),
  }),
  z.object({
    type: z.literal("stat_change"),
    countryId: z.string(),
    stat: z.string(),
    newValue: z.number(),
  }),
  z.object({
    type: z.literal("country_add"),
    countryId: z.string(),
    name: z.string(),
    color: z.string(),
    leaderName: z.string().optional().default(""),
  }),
  z.object({
    type: z.literal("country_remove"),
    countryId: z.string(),
  }),
]);

export type Delta = z.infer<typeof DeltaSchema>;

export const SimulationEventSchema = z.object({
  category: z.enum([
    "military",
    "diplomacy",
    "borders",
    "economy",
    "internal",
  ]),
  title: z.string(),
  body: z.string(),
  deltas: z.array(DeltaSchema).default([]),
});

export const SimulationOutputSchema = z.object({
  newDate: z.string(),
  events: z.array(SimulationEventSchema),
  voidedActions: z
    .array(
      z.object({
        actionId: z.string(),
        reason: z.string(),
      })
    )
    .default([]),
});

export type SimulationOutput = z.infer<typeof SimulationOutputSchema>;
export type SimulationEvent = z.infer<typeof SimulationEventSchema>;
