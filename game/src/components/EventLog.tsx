"use client";

import { useState } from "react";

interface GameEvent {
  id: string;
  round: number;
  date: string;
  category: string;
  title: string;
  body: string;
}

interface EventLogProps {
  events: GameEvent[];
}

const CATEGORY_ICONS: Record<string, string> = {
  military: "⚔️",
  diplomacy: "🤝",
  borders: "🗺️",
  economy: "💰",
  internal: "🏛️",
};

export default function EventLog({ events }: EventLogProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 bg-gray-700 hover:bg-gray-600 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg text-xl transition-transform hover:scale-110 z-50"
        title="Журнал событий"
      >
        📜
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 left-6 w-96 max-h-[60vh] bg-gray-900/95 border border-gray-700 rounded-lg shadow-2xl backdrop-blur-sm z-50 flex flex-col">
      <div className="flex justify-between items-center p-3 border-b border-gray-700 shrink-0">
        <h3 className="text-white font-semibold">📜 Журнал событий</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-white"
        >
          ✕
        </button>
      </div>
      <div className="overflow-y-auto p-3 space-y-2 flex-1">
        {events.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">
            Событий пока нет
          </p>
        ) : (
          events.map((ev) => (
            <div
              key={ev.id}
              className="bg-gray-800 rounded-lg p-3 border border-gray-700"
            >
              <div className="flex items-center gap-2 mb-1">
                <span>{CATEGORY_ICONS[ev.category] || "📜"}</span>
                <span className="text-white text-sm font-medium">
                  {ev.title}
                </span>
                <span className="ml-auto text-xs text-gray-500">
                  Р.{ev.round}
                </span>
              </div>
              <p className="text-gray-400 text-xs">{ev.body}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
