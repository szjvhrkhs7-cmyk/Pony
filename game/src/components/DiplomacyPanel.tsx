"use client";

import { useState } from "react";

interface Country {
  countryId: string;
  name: string;
  color: string;
  leaderName: string;
  relations: string;
}

interface ChatMessage {
  id: string;
  role: string;
  speakerCountryId: string | null;
  text: string;
}

interface ChatThread {
  id: string;
  participantCountryIds: string;
  messages: ChatMessage[];
}

interface DiplomacyPanelProps {
  gameId: string;
  playerCountryId: string;
  countries: Country[];
}

export default function DiplomacyPanel({
  gameId,
  playerCountryId,
  countries,
}: DiplomacyPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThread, setActiveThread] = useState<ChatThread | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const otherCountries = countries.filter(
    (c) => c.countryId !== playerCountryId
  );

  const openChat = async (country: Country) => {
    setSelectedCountry(country);
    const res = await fetch(`/api/game/${gameId}/chat`);
    const allThreads: ChatThread[] = await res.json();
    setThreads(allThreads);

    const existing = allThreads.find((t) => {
      const participants = JSON.parse(t.participantCountryIds);
      return (
        participants.includes(playerCountryId) &&
        participants.includes(country.countryId)
      );
    });

    setActiveThread(existing || null);
  };

  const sendMessage = async () => {
    if (!message.trim() || !selectedCountry) return;
    setSending(true);

    const res = await fetch(`/api/game/${gameId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetCountryId: selectedCountry.countryId,
        message: message.trim(),
        threadId: activeThread?.id,
      }),
    });

    const updatedThread = await res.json();
    setActiveThread(updatedThread);
    setMessage("");
    setSending(false);
  };

  const getRelationScore = (country: Country): number => {
    const rels = JSON.parse(country.relations);
    return rels[playerCountryId] ?? 0;
  };

  const getRelationColor = (score: number): string => {
    if (score > 30) return "text-green-400";
    if (score > 0) return "text-blue-400";
    if (score > -30) return "text-yellow-400";
    return "text-red-400";
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-6 bg-purple-600 hover:bg-purple-700 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg text-xl transition-transform hover:scale-110 z-50"
        title="Дипломатия"
      >
        💬
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-[420px] max-h-[70vh] bg-gray-900/95 border border-gray-700 rounded-lg shadow-2xl backdrop-blur-sm z-50 flex flex-col">
      <div className="flex justify-between items-center p-3 border-b border-gray-700 shrink-0">
        <h3 className="text-white font-semibold">
          💬 {selectedCountry ? `Переговоры: ${selectedCountry.name}` : "Дипломатия"}
        </h3>
        <div className="flex gap-2">
          {selectedCountry && (
            <button
              onClick={() => {
                setSelectedCountry(null);
                setActiveThread(null);
              }}
              className="text-gray-400 hover:text-white text-sm"
            >
              ← Назад
            </button>
          )}
          <button
            onClick={() => {
              setIsOpen(false);
              setSelectedCountry(null);
              setActiveThread(null);
            }}
            className="text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      </div>

      {!selectedCountry ? (
        <div className="p-3 space-y-2 overflow-y-auto flex-1">
          {otherCountries.map((c) => {
            const score = getRelationScore(c);
            return (
              <button
                key={c.countryId}
                onClick={() => openChat(c)}
                className="w-full text-left p-3 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: c.color }}
                  />
                  <span className="text-white font-medium text-sm">
                    {c.name}
                  </span>
                  <span
                    className={`ml-auto text-xs font-mono ${getRelationColor(score)}`}
                  >
                    {score > 0 ? "+" : ""}
                    {score}
                  </span>
                </div>
                <p className="text-gray-500 text-xs mt-1">{c.leaderName}</p>
              </button>
            );
          })}
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[200px]">
            {activeThread?.messages.map((m) => {
              const isPlayer = m.role === "player";
              const speaker = m.speakerCountryId
                ? countries.find((c) => c.countryId === m.speakerCountryId)
                : null;
              return (
                <div
                  key={m.id}
                  className={`flex ${isPlayer ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-2.5 text-sm ${
                      isPlayer
                        ? "bg-blue-600 text-white"
                        : "bg-gray-800 text-gray-200 border border-gray-700"
                    }`}
                  >
                    {!isPlayer && (
                      <p className="text-xs font-medium mb-1" style={{ color: speaker?.color }}>
                        {speaker?.leaderName || speaker?.name}
                      </p>
                    )}
                    {m.text}
                  </div>
                </div>
              );
            })}
            {!activeThread?.messages.length && (
              <p className="text-gray-500 text-sm text-center py-8">
                Начните переговоры с {selectedCountry.name}
              </p>
            )}
          </div>
          <div className="p-3 border-t border-gray-700 shrink-0">
            <div className="flex gap-2">
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="Ваше послание..."
                className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
              />
              <button
                onClick={sendMessage}
                disabled={!message.trim() || sending}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 text-white rounded-lg px-4 py-2 text-sm transition-colors"
              >
                {sending ? "..." : "→"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
