import { describe, it, expect } from "vitest";
import { runStubSimulation } from "@/lib/engine/stub";
import { SimulationOutputSchema } from "@/lib/schemas";

const baseInput = {
  gameId: "test-game",
  currentDate: "1190-01-01",
  round: 1,
  actions: [],
  regions: [
    { id: "gr1", regionId: "r1", ownerCountryId: "c1" },
    { id: "gr2", regionId: "r2", ownerCountryId: "c2" },
  ],
  countries: [
    {
      id: "gc1",
      countryId: "c1",
      name: "Testland",
      stats: '{"economy":50,"military":50,"stability":50}',
      relations: '{"c2":0}',
    },
    {
      id: "gc2",
      countryId: "c2",
      name: "Rivalland",
      stats: '{"economy":50,"military":50,"stability":50}',
      relations: '{"c1":0}',
    },
  ],
  points: [],
  playerCountryId: "c1",
  timeJump: "month",
};

describe("runStubSimulation", () => {
  it("produces valid SimulationOutput", () => {
    const result = runStubSimulation(baseInput);
    expect(() => SimulationOutputSchema.parse(result)).not.toThrow();
  });

  it("advances date by one month for month jump", () => {
    const result = runStubSimulation(baseInput);
    expect(result.newDate).toBe("1190-02-01");
  });

  it("advances date by one year for year jump", () => {
    const result = runStubSimulation({ ...baseInput, timeJump: "year" });
    expect(result.newDate).toBe("1191-01-01");
  });

  it("advances date by one week for week jump", () => {
    const result = runStubSimulation({ ...baseInput, timeJump: "week" });
    expect(result.newDate).toBe("1190-01-08");
  });

  it("generates military event for army-related action", () => {
    const result = runStubSimulation({
      ...baseInput,
      actions: [{ id: "a1", text: "Укрепить армию" }],
    });
    const militaryEvent = result.events.find((e) => e.category === "military");
    expect(militaryEvent).toBeTruthy();
    expect(militaryEvent!.deltas.length).toBeGreaterThan(0);
  });

  it("generates economy event for trade-related action", () => {
    const result = runStubSimulation({
      ...baseInput,
      actions: [{ id: "a1", text: "Развить торговлю" }],
    });
    const econEvent = result.events.find((e) => e.category === "economy");
    expect(econEvent).toBeTruthy();
  });

  it("generates diplomacy event for alliance action", () => {
    const result = runStubSimulation({
      ...baseInput,
      actions: [{ id: "a1", text: "Заключить союз" }],
    });
    const diploEvent = result.events.find((e) => e.category === "diplomacy");
    expect(diploEvent).toBeTruthy();
  });

  it("generates internal event for generic action", () => {
    const result = runStubSimulation({
      ...baseInput,
      actions: [{ id: "a1", text: "Построить замок" }],
    });
    const internalEvent = result.events.find((e) => e.category === "internal");
    expect(internalEvent).toBeTruthy();
  });

  it("always returns at least one event", () => {
    const result = runStubSimulation(baseInput);
    expect(result.events.length).toBeGreaterThanOrEqual(1);
  });

  it("never returns voidedActions in stub mode", () => {
    const result = runStubSimulation({
      ...baseInput,
      actions: [{ id: "a1", text: "Conquer the world" }],
    });
    expect(result.voidedActions).toEqual([]);
  });

  it("stat changes are bounded to 100", () => {
    const input = {
      ...baseInput,
      countries: [
        {
          ...baseInput.countries[0],
          stats: '{"economy":50,"military":95,"stability":50}',
        },
        baseInput.countries[1],
      ],
      actions: [{ id: "a1", text: "Укрепить армию" }],
    };
    const result = runStubSimulation(input);
    for (const event of result.events) {
      for (const delta of event.deltas) {
        if (delta.type === "stat_change") {
          expect(delta.newValue).toBeLessThanOrEqual(100);
        }
      }
    }
  });
});
