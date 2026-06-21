"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Country {
  id: string;
  name: string;
  color: string;
  leaderName: string;
  stats: string;
}

interface Preset {
  id: string;
  name: string;
  description: string;
  startDate: string;
  countries: Country[];
}

export default function Home() {
  const router = useRouter();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/presets")
      .then((r) => r.json())
      .then((data) => {
        setPresets(data);
        if (data.length > 0) {
          setSelectedPreset(data[0]);
          if (data[0].countries.length > 0) {
            setSelectedCountry(data[0].countries[0].id);
          }
        }
      });
  }, []);

  const startGame = async () => {
    if (!selectedPreset || !selectedCountry) return;
    setCreating(true);
    const res = await fetch("/api/game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        presetId: selectedPreset.id,
        playerCountryId: selectedCountry,
      }),
    });
    const { gameId } = await res.json();
    router.push(`/game/${gameId}`);
  };

  return (
    <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
      <div className="w-full max-w-2xl mx-auto p-8">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-amber-400 mb-2 tracking-tight">
            Pax Alterna
          </h1>
          <p className="text-gray-400 text-lg">
            Песочница альтернативной истории
          </p>
        </div>

        {presets.length === 0 ? (
          <div className="text-center py-12">
            <div className="animate-spin w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-400">Загрузка пресетов...</p>
          </div>
        ) : (
          <div className="bg-gray-900/80 border border-gray-700 rounded-xl p-6 backdrop-blur-sm">
            <h2 className="text-white text-xl font-semibold mb-4">
              Выберите сценарий
            </h2>

            <div className="space-y-3 mb-6">
              {presets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedPreset(p);
                    if (p.countries.length > 0)
                      setSelectedCountry(p.countries[0].id);
                  }}
                  className={`w-full text-left p-4 rounded-lg border transition-all ${
                    selectedPreset?.id === p.id
                      ? "bg-amber-900/30 border-amber-600"
                      : "bg-gray-800 border-gray-700 hover:border-gray-600"
                  }`}
                >
                  <h3 className="text-white font-medium">{p.name}</h3>
                  <p className="text-gray-400 text-sm mt-1">{p.description}</p>
                  <p className="text-gray-500 text-xs mt-1">
                    Начало: {p.startDate}
                  </p>
                </button>
              ))}
            </div>

            {selectedPreset && (
              <>
                <h2 className="text-white text-xl font-semibold mb-4">
                  Выберите страну
                </h2>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {selectedPreset.countries.map((c) => {
                    const stats = JSON.parse(c.stats);
                    return (
                      <button
                        key={c.id}
                        onClick={() => setSelectedCountry(c.id)}
                        className={`p-4 rounded-lg border transition-all text-left ${
                          selectedCountry === c.id
                            ? "border-2 border-white bg-gray-800"
                            : "border border-gray-700 bg-gray-800/50 hover:border-gray-600"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: c.color }}
                          />
                          <span className="text-white font-medium text-sm">
                            {c.name}
                          </span>
                        </div>
                        <p className="text-gray-500 text-xs mb-2">
                          {c.leaderName}
                        </p>
                        <div className="space-y-1">
                          {Object.entries(stats).map(([k, v]) => (
                            <div
                              key={k}
                              className="flex items-center gap-1.5"
                            >
                              <span className="text-[10px] text-gray-500 w-14">
                                {k === "economy"
                                  ? "Эконом."
                                  : k === "military"
                                    ? "Армия"
                                    : k === "stability"
                                      ? "Стабильн."
                                      : k}
                              </span>
                              <div className="flex-1 h-1.5 bg-gray-700 rounded-full">
                                <div
                                  className="h-full rounded-full bg-blue-500"
                                  style={{
                                    width: `${v}%`,
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={startGame}
                  disabled={creating || !selectedCountry}
                  className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg py-3 text-lg font-semibold transition-colors"
                >
                  {creating ? "Создание мира..." : "Начать игру"}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
