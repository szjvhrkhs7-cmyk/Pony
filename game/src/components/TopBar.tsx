"use client";

interface TopBarProps {
  countryName: string;
  countryColor: string;
  date: string;
  round: number;
  leaderName: string;
}

export default function TopBar({
  countryName,
  countryColor,
  date,
  round,
  leaderName,
}: TopBarProps) {
  const formatDate = (d: string) => {
    try {
      const parts = d.split("-");
      const months = [
        "Янв",
        "Фев",
        "Мар",
        "Апр",
        "Май",
        "Июн",
        "Июл",
        "Авг",
        "Сен",
        "Окт",
        "Ноя",
        "Дек",
      ];
      return `${parts[2]} ${months[parseInt(parts[1]) - 1]} ${parts[0]}`;
    } catch {
      return d;
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 h-14 bg-gray-900/90 border-b border-gray-700 backdrop-blur-sm flex items-center px-6 z-40">
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-full border-2 border-white/30"
          style={{ backgroundColor: countryColor }}
        />
        <div>
          <h1 className="text-white font-bold text-sm">{countryName}</h1>
          <p className="text-gray-400 text-xs">{leaderName}</p>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-6">
        <div className="text-right">
          <p className="text-amber-400 font-mono text-sm">
            {formatDate(date)}
          </p>
          <p className="text-gray-500 text-xs">Раунд {round}</p>
        </div>
      </div>
    </div>
  );
}
