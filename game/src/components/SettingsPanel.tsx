"use client";

import { useState, useEffect } from "react";

interface SettingsPanelProps {
  gameId: string;
}

const DIFFICULTIES = [
  { value: "very_easy", label: "Очень легко" },
  { value: "easy", label: "Легко" },
  { value: "normal", label: "Нормально" },
  { value: "hard", label: "Сложно" },
  { value: "very_hard", label: "Очень сложно" },
  { value: "impossible", label: "Невозможно" },
];

export default function SettingsPanel({ gameId }: SettingsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [difficulty, setDifficulty] = useState("normal");
  const [aiModel, setAiModel] = useState("stub");
  const [saving, setSaving] = useState(false);
  const [consolidating, setConsolidating] = useState(false);
  const [consolidationResult, setConsolidationResult] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetch(`/api/game/${gameId}/settings`)
        .then((r) => r.json())
        .then((data) => {
          setDifficulty(data.difficulty);
          setAiModel(data.aiModel);
        });
    }
  }, [isOpen, gameId]);

  const saveSettings = async () => {
    setSaving(true);
    await fetch(`/api/game/${gameId}/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ difficulty, aiModel }),
    });
    setSaving(false);
  };

  const runConsolidation = async () => {
    setConsolidating(true);
    setConsolidationResult("");
    const res = await fetch(`/api/game/${gameId}/consolidate`, {
      method: "POST",
    });
    const data = await res.json();
    if (data.consolidated) {
      setConsolidationResult(
        `Консолидировано ${data.consolidated} блоков событий.`
      );
    } else {
      setConsolidationResult(
        data.message || "Недостаточно раундов для консолидации."
      );
    }
    setConsolidating(false);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-6 left-6 bg-gray-700 hover:bg-gray-600 text-white rounded-full w-10 h-10 flex items-center justify-center shadow-lg text-lg transition-transform hover:scale-110 z-50"
        title="Настройки"
      >
        ⚙
      </button>
    );
  }

  return (
    <div className="fixed top-6 left-6 w-80 bg-gray-900/95 border border-gray-700 rounded-lg shadow-2xl backdrop-blur-sm z-50">
      <div className="flex justify-between items-center p-3 border-b border-gray-700">
        <h3 className="text-white font-semibold">⚙ Настройки</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-white"
        >
          ✕
        </button>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <label className="text-gray-400 text-xs block mb-1.5">
            Сложность
          </label>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
          >
            {DIFFICULTIES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-gray-400 text-xs block mb-1.5">
            Модель ИИ
          </label>
          <input
            value={aiModel}
            onChange={(e) => setAiModel(e.target.value)}
            placeholder="stub (заглушка) или название модели"
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
          />
          <p className="text-gray-500 text-[10px] mt-1">
            Для работы ИИ задайте LLM_PROVIDER и API ключ в .env
          </p>
        </div>

        <button
          onClick={saveSettings}
          disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white rounded-lg py-2 text-sm transition-colors"
        >
          {saving ? "Сохранение..." : "Сохранить настройки"}
        </button>

        <div className="border-t border-gray-700 pt-3">
          <label className="text-gray-400 text-xs block mb-1.5">
            Контекст-менеджмент
          </label>
          <button
            onClick={runConsolidation}
            disabled={consolidating}
            className="w-full bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800 text-gray-300 rounded-lg py-2 text-xs border border-gray-600 transition-colors"
          >
            {consolidating
              ? "Консолидация..."
              : "Консолидировать историю"}
          </button>
          {consolidationResult && (
            <p className="text-gray-400 text-[10px] mt-1">
              {consolidationResult}
            </p>
          )}
          <p className="text-gray-500 text-[10px] mt-1">
            Сжимает старые события в сводки для экономии контекста LLM
          </p>
        </div>
      </div>
    </div>
  );
}
