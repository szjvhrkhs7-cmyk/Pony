"use client";

import { useEffect, useState, useCallback, use } from "react";
import GameMap from "@/components/GameMap";
import ActionPanel from "@/components/ActionPanel";
import JumpPanel from "@/components/JumpPanel";
import TopBar from "@/components/TopBar";
import EventLog from "@/components/EventLog";
import DiplomacyPanel from "@/components/DiplomacyPanel";
import AdvisorPanel from "@/components/AdvisorPanel";

interface GameData {
  id: string;
  playerCountryId: string;
  currentDate: string;
  round: number;
  preset: { name: string };
  events: {
    id: string;
    round: number;
    date: string;
    category: string;
    title: string;
    body: string;
  }[];
  regions: {
    id: string;
    regionId: string;
    name: string;
    type: string;
    geometry: string;
    ownerCountryId: string | null;
  }[];
  countries: {
    id: string;
    countryId: string;
    name: string;
    color: string;
    leaderName: string;
    stats: string;
    relations: string;
  }[];
  points: {
    id: string;
    pointId: string;
    type: string;
    regionId: string;
    coordX: number;
    coordY: number;
    ownerCountryId: string | null;
    label: string;
    strength: number;
  }[];
}

export default function GamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [game, setGame] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [animatedRegions, setAnimatedRegions] = useState<string[]>([]);

  const loadGame = useCallback(async () => {
    const res = await fetch(`/api/game/${id}`);
    const data = await res.json();
    setGame(data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadGame();
  }, [loadGame]);

  const handleJumpComplete = (data: {
    newDate: string;
    newRound: number;
    events: { category: string; title: string; body: string }[];
    regions?: GameData["regions"];
    countries?: GameData["countries"];
    points?: GameData["points"];
  }) => {
    if (game) {
      const changedRegionIds: string[] = [];
      if (data.regions) {
        for (const newR of data.regions) {
          const oldR = game.regions.find((r) => r.regionId === newR.regionId);
          if (oldR && oldR.ownerCountryId !== newR.ownerCountryId) {
            changedRegionIds.push(newR.regionId);
          }
        }
      }

      setGame({
        ...game,
        currentDate: data.newDate,
        round: data.newRound,
        regions: data.regions || game.regions,
        countries: data.countries || game.countries,
        points: data.points || game.points,
        events: [
          ...data.events.map((e, i) => ({
            id: `new-${Date.now()}-${i}`,
            round: data.newRound - 1,
            date: data.newDate,
            ...e,
          })),
          ...game.events,
        ],
      });

      if (changedRegionIds.length > 0) {
        setAnimatedRegions(changedRegionIds);
        setTimeout(() => setAnimatedRegions([]), 3000);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-amber-400 text-lg">Загрузка мира...</p>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
        <p className="text-red-400 text-lg">Игра не найдена</p>
      </div>
    );
  }

  const playerCountry = game.countries.find(
    (c) => c.countryId === game.playerCountryId
  );

  return (
    <div className="min-h-screen bg-[#1a1a2e] overflow-hidden">
      <TopBar
        countryName={playerCountry?.name || "???"}
        countryColor={playerCountry?.color || "#666"}
        date={game.currentDate}
        round={game.round}
        leaderName={playerCountry?.leaderName || ""}
      />

      <div className="pt-14 h-screen">
        <GameMap
          regions={game.regions}
          countries={game.countries}
          points={game.points}
          playerCountryId={game.playerCountryId}
          animatedRegions={animatedRegions}
        />
      </div>

      <ActionPanel
        gameId={game.id}
        round={game.round}
        onActionAdded={loadGame}
      />

      <DiplomacyPanel
        gameId={game.id}
        playerCountryId={game.playerCountryId}
        countries={game.countries}
      />

      <AdvisorPanel
        gameId={game.id}
        countryColor={playerCountry?.color || "#666"}
      />

      <JumpPanel gameId={game.id} onJumpComplete={handleJumpComplete} />

      <EventLog events={game.events} />
    </div>
  );
}
