"use client";

import { useState } from "react";

interface JumpEvent {
  category: string;
  title: string;
  body: string;
}

interface JumpPanelProps {
  gameId: string;
  onJumpComplete: (data: {
    newDate: string;
    newRound: number;
    events: JumpEvent[];
  }) => void;
}

const TIME_OPTIONS = [
  { value: "week", label: "Неделя" },
  { value: "month", label: "Месяц" },
  { value: "3months", label: "3 месяца" },
  { value: "6months", label: "6 месяцев" },
  { value: "year", label: "Год" },
];

const CATEGORY_ICONS: Record<string, string> = {
  military: "⚔️",
  diplomacy: "🤝",
  borders: "🗺️",
  economy: "💰",
  internal: "🏛️",
};

export default function JumpPanel({ gameId, onJumpComplete }: JumpPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [jumping, setJumping] = useState(false);
  const [events, setEvents] = useState<JumpEvent[]>([]);
  const [eventIndex, setEventIndex] = useState(0);
  const [showingEvents, setShowingEvents] = useState(false);

  const doJump = async (timeJump: string) => {
    setJumping(true);
    const res = await fetch(`/api/game/${gameId}/jump`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timeJump }),
    });
    const data = await res.json();
    setJumping(false);

    if (data.events && data.events.length > 0) {
      setEvents(data.events);
      setEventIndex(0);
      setShowingEvents(true);
    }

    onJumpComplete(data);
  };

  const nextEvent = () => {
    if (eventIndex < events.length - 1) {
      setEventIndex(eventIndex + 1);
    } else {
      setShowingEvents(false);
      setEvents([]);
      setIsOpen(false);
    }
  };

  if (showingEvents && events.length > 0) {
    const ev = events[eventIndex];
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
        <div className="bg-gray-900 border border-gray-700 rounded-lg w-[500px] max-w-[90vw] shadow-2xl">
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span>
                Событие {eventIndex + 1} из {events.length}
              </span>
              <span className="ml-auto px-2 py-0.5 bg-gray-800 rounded text-xs">
                {CATEGORY_ICONS[ev.category] || "📜"}{" "}
                {ev.category === "military"
                  ? "Военное"
                  : ev.category === "diplomacy"
                    ? "Дипломатия"
                    : ev.category === "borders"
                      ? "Границы"
                      : ev.category === "economy"
                        ? "Экономика"
                        : "Внутреннее"}
              </span>
            </div>
          </div>
          <div className="p-6">
            <h3 className="text-xl font-bold text-white mb-3">{ev.title}</h3>
            <p className="text-gray-300 text-sm leading-relaxed">{ev.body}</p>
          </div>
          <div className="p-4 border-t border-gray-700 flex justify-end">
            <button
              onClick={nextEvent}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 py-2 text-sm font-medium transition-colors"
            >
              {eventIndex < events.length - 1 ? "Далее →" : "Закрыть"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-6 right-6 bg-amber-600 hover:bg-amber-700 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg text-xl transition-transform hover:scale-110 z-50"
        title="Прыжок вперёд"
      >
        ⏩
      </button>
    );
  }

  return (
    <div className="fixed top-6 right-6 w-72 bg-gray-900/95 border border-gray-700 rounded-lg shadow-2xl backdrop-blur-sm z-50">
      <div className="flex justify-between items-center p-3 border-b border-gray-700">
        <h3 className="text-white font-semibold">⏩ Прыжок во времени</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-white"
        >
          ✕
        </button>
      </div>
      <div className="p-3 space-y-2">
        {jumping ? (
          <div className="flex flex-col items-center py-8">
            <div className="animate-spin w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full mb-3" />
            <p className="text-amber-400 text-sm">Симуляция идёт...</p>
          </div>
        ) : (
          TIME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => doJump(opt.value)}
              className="w-full text-left px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm transition-colors"
            >
              {opt.label}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
