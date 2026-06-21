"use client";

import { useState } from "react";

interface AdvisorPanelProps {
  gameId: string;
  countryColor: string;
}

interface Message {
  role: "player" | "advisor";
  text: string;
}

export default function AdvisorPanel({
  gameId,
  countryColor,
}: AdvisorPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);

  const ask = async () => {
    const q = question.trim() || "Дайте общую оценку обстановки.";
    setMessages((prev) => [...prev, { role: "player", text: q }]);
    setQuestion("");
    setLoading(true);

    const res = await fetch(`/api/game/${gameId}/advisor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q }),
    });
    const data = await res.json();
    setMessages((prev) => [...prev, { role: "advisor", text: data.response }]);
    setLoading(false);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-42 right-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg text-xl transition-transform hover:scale-110 z-50"
        title="Советник"
        style={{ bottom: "10.5rem" }}
      >
        🎓
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-24 w-96 max-h-[60vh] bg-gray-900/95 border border-gray-700 rounded-lg shadow-2xl backdrop-blur-sm z-50 flex flex-col">
      <div className="flex justify-between items-center p-3 border-b border-gray-700 shrink-0">
        <h3 className="text-white font-semibold">🎓 Советник</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-white"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[150px]">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "player" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-lg p-2.5 text-sm ${
                m.role === "player"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-200 border border-gray-700"
              }`}
            >
              {m.role === "advisor" && (
                <p className="text-xs font-medium mb-1 text-emerald-400">
                  Советник
                </p>
              )}
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                <div
                  className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                  style={{ animationDelay: "0.1s" }}
                />
                <div
                  className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                />
              </div>
            </div>
          </div>
        )}
        {messages.length === 0 && !loading && (
          <p className="text-gray-500 text-sm text-center py-8">
            Задайте вопрос советнику или запросите оценку обстановки
          </p>
        )}
      </div>

      <div className="p-3 border-t border-gray-700 shrink-0">
        <div className="flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask()}
            placeholder="Ваш вопрос советнику..."
            className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
          />
          <button
            onClick={ask}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 text-white rounded-lg px-4 py-2 text-sm transition-colors"
          >
            {loading ? "..." : "→"}
          </button>
        </div>
      </div>
    </div>
  );
}
