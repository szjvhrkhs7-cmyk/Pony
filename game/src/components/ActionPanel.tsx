"use client";

import { useState } from "react";

interface ActionPanelProps {
  gameId: string;
  round: number;
  onActionAdded: () => void;
}

export default function ActionPanel({
  gameId,
  round,
  onActionAdded,
}: ActionPanelProps) {
  const [text, setText] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [brainstorming, setBrainstorming] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [suggestions, setSuggestions] = useState("");

  const submit = async () => {
    if (!text.trim()) return;
    setSending(true);
    await fetch(`/api/game/${gameId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.trim() }),
    });
    setText("");
    setSending(false);
    setSuggestions("");
    onActionAdded();
  };

  const brainstorm = async () => {
    setBrainstorming(true);
    const res = await fetch(`/api/game/${gameId}/brainstorm`, {
      method: "POST",
    });
    const data = await res.json();
    setSuggestions(data.suggestions);
    setBrainstorming(false);
  };

  const polish = async () => {
    if (!text.trim()) return;
    setPolishing(true);
    const res = await fetch(`/api/game/${gameId}/polish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.trim() }),
    });
    const data = await res.json();
    setText(data.polished);
    setPolishing(false);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg text-2xl transition-transform hover:scale-110 z-50"
        title="Действия"
      >
        ⚡
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 bg-gray-900/95 border border-gray-700 rounded-lg shadow-2xl backdrop-blur-sm z-50">
      <div className="flex justify-between items-center p-3 border-b border-gray-700">
        <h3 className="text-white font-semibold">⚡ Действия (Раунд {round})</h3>
        <button
          onClick={() => {
            setIsOpen(false);
            setSuggestions("");
          }}
          className="text-gray-400 hover:text-white"
        >
          ✕
        </button>
      </div>
      <div className="p-3">
        {suggestions && (
          <div className="mb-3 bg-gray-800 border border-gray-700 rounded-lg p-3">
            <p className="text-xs text-amber-400 mb-1 font-medium">
              Идеи действий:
            </p>
            <p className="text-gray-300 text-xs whitespace-pre-line">
              {suggestions}
            </p>
          </div>
        )}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Опишите действие свободным текстом... Например: «Укрепить армию на северной границе» или «Направить послов в Англию»"
          className="w-full h-28 bg-gray-800 border border-gray-600 rounded-lg p-3 text-white text-sm resize-none focus:outline-none focus:border-blue-500 placeholder-gray-500"
        />
        <div className="flex gap-2 mt-2">
          <button
            onClick={brainstorm}
            disabled={brainstorming}
            className="bg-amber-700 hover:bg-amber-600 disabled:bg-gray-700 text-white rounded-lg px-3 py-2 text-xs transition-colors"
            title="Сгенерировать идеи действий"
          >
            {brainstorming ? "..." : "💡 Идеи"}
          </button>
          <button
            onClick={polish}
            disabled={!text.trim() || polishing}
            className="bg-emerald-700 hover:bg-emerald-600 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg px-3 py-2 text-xs transition-colors"
            title="Отполировать приказ"
          >
            {polishing ? "..." : "✨ Улучшить"}
          </button>
          <button
            onClick={submit}
            disabled={!text.trim() || sending}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            {sending ? "Отправка..." : "Отдать приказ"}
          </button>
        </div>
      </div>
    </div>
  );
}
