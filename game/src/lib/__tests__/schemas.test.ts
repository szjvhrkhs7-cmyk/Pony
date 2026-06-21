import { describe, it, expect } from "vitest";
import {
  DeltaSchema,
  SimulationOutputSchema,
  SimulationEventSchema,
} from "@/lib/schemas";

describe("DeltaSchema", () => {
  it("validates region_owner_change", () => {
    const delta = { type: "region_owner_change", regionId: "r1", newOwnerId: "c1" };
    expect(DeltaSchema.parse(delta)).toEqual(delta);
  });

  it("validates region_owner_change with null owner", () => {
    const delta = { type: "region_owner_change", regionId: "r1", newOwnerId: null };
    expect(DeltaSchema.parse(delta)).toEqual(delta);
  });

  it("validates stat_change", () => {
    const delta = { type: "stat_change", countryId: "c1", stat: "economy", newValue: 75 };
    expect(DeltaSchema.parse(delta)).toEqual(delta);
  });

  it("validates relation_change with bounds", () => {
    expect(
      DeltaSchema.parse({
        type: "relation_change",
        countryId: "c1",
        targetCountryId: "c2",
        newScore: 100,
      })
    ).toBeTruthy();

    expect(
      DeltaSchema.parse({
        type: "relation_change",
        countryId: "c1",
        targetCountryId: "c2",
        newScore: -100,
      })
    ).toBeTruthy();

    expect(() =>
      DeltaSchema.parse({
        type: "relation_change",
        countryId: "c1",
        targetCountryId: "c2",
        newScore: 101,
      })
    ).toThrow();

    expect(() =>
      DeltaSchema.parse({
        type: "relation_change",
        countryId: "c1",
        targetCountryId: "c2",
        newScore: -101,
      })
    ).toThrow();
  });

  it("validates point_add", () => {
    const delta = {
      type: "point_add",
      pointType: "city",
      regionId: "r1",
      coordX: 100,
      coordY: 200,
      ownerCountryId: "c1",
      label: "New City",
    };
    const result = DeltaSchema.parse(delta);
    expect(result.type).toBe("point_add");
    expect((result as { strength: number }).strength).toBe(0);
  });

  it("validates point_move", () => {
    const delta = {
      type: "point_move",
      pointId: "p1",
      newRegionId: "r2",
      newCoordX: 300,
      newCoordY: 400,
    };
    expect(DeltaSchema.parse(delta)).toEqual(delta);
  });

  it("validates point_remove", () => {
    expect(DeltaSchema.parse({ type: "point_remove", pointId: "p1" })).toEqual({
      type: "point_remove",
      pointId: "p1",
    });
  });

  it("validates country_add", () => {
    const delta = {
      type: "country_add",
      countryId: "new-c",
      name: "New Nation",
      color: "#ff0000",
    };
    const result = DeltaSchema.parse(delta);
    expect(result.type).toBe("country_add");
    expect((result as { leaderName: string }).leaderName).toBe("");
  });

  it("validates country_remove", () => {
    expect(
      DeltaSchema.parse({ type: "country_remove", countryId: "c1" })
    ).toEqual({ type: "country_remove", countryId: "c1" });
  });

  it("rejects invalid delta type", () => {
    expect(() =>
      DeltaSchema.parse({ type: "invalid_type", regionId: "r1" })
    ).toThrow();
  });

  it("rejects delta with missing fields", () => {
    expect(() =>
      DeltaSchema.parse({ type: "stat_change", countryId: "c1" })
    ).toThrow();
  });
});

describe("SimulationEventSchema", () => {
  it("validates a complete event", () => {
    const event = {
      category: "military",
      title: "Battle",
      body: "A great battle occurred",
      deltas: [{ type: "stat_change", countryId: "c1", stat: "military", newValue: 80 }],
    };
    expect(SimulationEventSchema.parse(event)).toBeTruthy();
  });

  it("defaults deltas to empty array", () => {
    const event = {
      category: "economy",
      title: "Trade boom",
      body: "Economy grows",
    };
    const result = SimulationEventSchema.parse(event);
    expect(result.deltas).toEqual([]);
  });

  it("rejects invalid category", () => {
    expect(() =>
      SimulationEventSchema.parse({
        category: "magic",
        title: "Spell",
        body: "A spell was cast",
      })
    ).toThrow();
  });
});

describe("SimulationOutputSchema", () => {
  it("validates a complete simulation output", () => {
    const output = {
      newDate: "1190-02-01",
      events: [
        {
          category: "military",
          title: "Battle",
          body: "A great battle",
          deltas: [
            { type: "stat_change", countryId: "c1", stat: "military", newValue: 70 },
          ],
        },
      ],
      voidedActions: [{ actionId: "a1", reason: "Unrealistic" }],
    };
    expect(SimulationOutputSchema.parse(output)).toBeTruthy();
  });

  it("defaults voidedActions to empty array", () => {
    const output = {
      newDate: "1190-02-01",
      events: [],
    };
    const result = SimulationOutputSchema.parse(output);
    expect(result.voidedActions).toEqual([]);
  });

  it("rejects output without newDate", () => {
    expect(() =>
      SimulationOutputSchema.parse({
        events: [],
      })
    ).toThrow();
  });

  it("rejects output without events", () => {
    expect(() =>
      SimulationOutputSchema.parse({
        newDate: "1190-02-01",
      })
    ).toThrow();
  });

  it("validates nested deltas inside events", () => {
    const output = {
      newDate: "1190-03-01",
      events: [
        {
          category: "borders",
          title: "Conquest",
          body: "Region captured",
          deltas: [
            { type: "region_owner_change", regionId: "r1", newOwnerId: "c2" },
            { type: "stat_change", countryId: "c2", stat: "military", newValue: 60 },
          ],
        },
      ],
    };
    const result = SimulationOutputSchema.parse(output);
    expect(result.events[0].deltas.length).toBe(2);
  });
});
