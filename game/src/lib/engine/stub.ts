import { SimulationOutput, Delta } from "@/lib/schemas";

interface StubInput {
  gameId: string;
  currentDate: string;
  round: number;
  actions: { id: string; text: string }[];
  regions: { id: string; regionId: string; ownerCountryId: string | null }[];
  countries: {
    id: string;
    countryId: string;
    name: string;
    stats: string;
    relations: string;
  }[];
  points: {
    id: string;
    pointId: string;
    type: string;
    regionId: string;
    ownerCountryId: string | null;
  }[];
  playerCountryId: string;
  timeJump: string;
}

function addTime(dateStr: string, timeJump: string): string {
  const d = new Date(dateStr);
  switch (timeJump) {
    case "week":
      d.setDate(d.getDate() + 7);
      break;
    case "month":
      d.setMonth(d.getMonth() + 1);
      break;
    case "3months":
      d.setMonth(d.getMonth() + 3);
      break;
    case "6months":
      d.setMonth(d.getMonth() + 6);
      break;
    case "year":
      d.setFullYear(d.getFullYear() + 1);
      break;
    default:
      d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString().split("T")[0];
}

export function runStubSimulation(input: StubInput): SimulationOutput {
  const newDate = addTime(input.currentDate, input.timeJump);
  const deltas: Delta[] = [];
  const events: SimulationOutput["events"] = [];

  const playerCountry = input.countries.find(
    (c) => c.countryId === input.playerCountryId
  );
  const playerName = playerCountry?.name ?? "Your Nation";

  const otherCountries = input.countries.filter(
    (c) => c.countryId !== input.playerCountryId
  );

  if (input.actions.length > 0) {
    const action = input.actions[0];
    const text = action.text.toLowerCase();

    if (text.includes("армию") || text.includes("army") || text.includes("military") || text.includes("войск")) {
      const stats = JSON.parse(playerCountry?.stats || "{}");
      const newMilitary = (stats.military || 50) + 10;
      deltas.push({
        type: "stat_change",
        countryId: input.playerCountryId,
        stat: "military",
        newValue: Math.min(newMilitary, 100),
      });
      events.push({
        category: "military",
        title: `${playerName} усиливает армию`,
        body: `По приказу лидера ${playerName}, вооружённые силы значительно укреплены. Военная мощь выросла.`,
        deltas: [deltas[deltas.length - 1]],
      });
    } else if (text.includes("экономик") || text.includes("econom") || text.includes("trade") || text.includes("торгов")) {
      const stats = JSON.parse(playerCountry?.stats || "{}");
      const newEconomy = (stats.economy || 50) + 8;
      deltas.push({
        type: "stat_change",
        countryId: input.playerCountryId,
        stat: "economy",
        newValue: Math.min(newEconomy, 100),
      });
      events.push({
        category: "economy",
        title: `Экономический рост в ${playerName}`,
        body: `Экономические реформы принесли плоды. Торговля расширяется, казна пополняется.`,
        deltas: [deltas[deltas.length - 1]],
      });
    } else if (text.includes("дипломат") || text.includes("diplomat") || text.includes("alliance") || text.includes("союз")) {
      if (otherCountries.length > 0) {
        const target = otherCountries[Math.floor(Math.random() * otherCountries.length)];
        const currentRelations = JSON.parse(playerCountry?.relations || "{}");
        const currentScore = currentRelations[target.countryId] ?? 0;
        const newScore = Math.min(currentScore + 20, 100);
        deltas.push({
          type: "relation_change",
          countryId: input.playerCountryId,
          targetCountryId: target.countryId,
          newScore,
        });
        events.push({
          category: "diplomacy",
          title: `Сближение ${playerName} и ${target.name}`,
          body: `Дипломатические усилия привели к улучшению отношений между ${playerName} и ${target.name}.`,
          deltas: [deltas[deltas.length - 1]],
        });
      }
    } else {
      events.push({
        category: "internal",
        title: `${playerName}: внутренние реформы`,
        body: `Руководство ${playerName} проводит внутренние реформы. Стабильность укрепляется.`,
        deltas: [],
      });
      const stats = JSON.parse(playerCountry?.stats || "{}");
      const newStability = (stats.stability || 50) + 5;
      const delta: Delta = {
        type: "stat_change",
        countryId: input.playerCountryId,
        stat: "stability",
        newValue: Math.min(newStability, 100),
      };
      deltas.push(delta);
      events[events.length - 1].deltas.push(delta);
    }
  }

  if (otherCountries.length >= 2 && Math.random() > 0.5) {
    const c1 = otherCountries[Math.floor(Math.random() * otherCountries.length)];
    let c2 = otherCountries[Math.floor(Math.random() * otherCountries.length)];
    if (c1.countryId !== c2.countryId) {
      const delta: Delta = {
        type: "relation_change",
        countryId: c1.countryId,
        targetCountryId: c2.countryId,
        newScore: Math.floor(Math.random() * 40) - 20,
      };
      deltas.push(delta);
      events.push({
        category: "diplomacy",
        title: `Напряжённость между ${c1.name} и ${c2.name}`,
        body: `Отношения между ${c1.name} и ${c2.name} претерпели изменения из-за внешнеполитических разногласий.`,
        deltas: [delta],
      });
    }
  }

  if (events.length === 0) {
    events.push({
      category: "internal",
      title: "Спокойный период",
      body: "Время проходит относительно мирно. Страны продолжают развиваться.",
      deltas: [],
    });
  }

  return {
    newDate,
    events,
    voidedActions: [],
  };
}
