"use client";

import { useState, useMemo } from "react";

interface Region {
  id: string;
  regionId: string;
  name: string;
  type: string;
  geometry: string;
  ownerCountryId: string | null;
}

interface Country {
  countryId: string;
  name: string;
  color: string;
  leaderName: string;
  stats: string;
  relations: string;
}

interface Point {
  id: string;
  pointId: string;
  type: string;
  regionId: string;
  coordX: number;
  coordY: number;
  ownerCountryId: string | null;
  label: string;
  strength: number;
}

interface GameMapProps {
  regions: Region[];
  countries: Country[];
  points: Point[];
  playerCountryId: string;
  animatedRegions?: string[];
}

function polygonToPath(coords: number[][]): string {
  if (coords.length === 0) return "";
  return (
    coords.map((c, i) => `${i === 0 ? "M" : "L"}${c[0]},${c[1]}`).join(" ") +
    " Z"
  );
}

function polygonCentroid(coords: number[][]): [number, number] {
  let cx = 0,
    cy = 0;
  for (const c of coords) {
    cx += c[0];
    cy += c[1];
  }
  return [cx / coords.length, cy / coords.length];
}

export default function GameMap({
  regions,
  countries,
  points,
  playerCountryId,
  animatedRegions = [],
}: GameMapProps) {
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    region: Region;
  } | null>(null);

  const countryMap = useMemo(() => {
    const map = new Map<string, Country>();
    for (const c of countries) map.set(c.countryId, c);
    return map;
  }, [countries]);

  const getColor = (ownerId: string | null) => {
    if (!ownerId) return "#374151";
    return countryMap.get(ownerId)?.color ?? "#6B7280";
  };

  return (
    <div className="relative w-full h-full bg-[#1a1a2e]">
      <svg
        viewBox="100 20 700 480"
        className="w-full h-full"
        style={{ minHeight: "500px" }}
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <pattern
            id="water"
            width="10"
            height="10"
            patternUnits="userSpaceOnUse"
          >
            <rect width="10" height="10" fill="#1e3a5f" />
            <line
              x1="0"
              y1="5"
              x2="10"
              y2="5"
              stroke="#2563eb"
              strokeWidth="0.3"
              opacity="0.3"
            />
          </pattern>
        </defs>

        <rect x="100" y="20" width="700" height="480" fill="url(#water)" />

        {regions.map((r) => {
          const coords = JSON.parse(r.geometry) as number[][];
          const path = polygonToPath(coords);
          const isAnimated = animatedRegions.includes(r.regionId);
          const isSelected = selectedRegion?.regionId === r.regionId;
          const owner = r.ownerCountryId
            ? countryMap.get(r.ownerCountryId)
            : null;
          const isPlayer = r.ownerCountryId === playerCountryId;

          return (
            <g key={r.regionId}>
              <path
                d={path}
                fill={getColor(r.ownerCountryId)}
                fillOpacity={0.7}
                stroke={isSelected ? "#ffffff" : "#000000"}
                strokeWidth={isSelected ? 2 : 1}
                className={`cursor-pointer transition-all duration-300 hover:fill-opacity-90 ${
                  isAnimated ? "animate-pulse" : ""
                }`}
                onClick={() =>
                  setSelectedRegion(
                    selectedRegion?.regionId === r.regionId ? null : r
                  )
                }
                onMouseEnter={(e) => {
                  const rect = (
                    e.target as SVGElement
                  ).ownerSVGElement!.getBoundingClientRect();
                  const svgX =
                    ((e.clientX - rect.left) / rect.width) * 700 + 100;
                  const svgY =
                    ((e.clientY - rect.top) / rect.height) * 480 + 20;
                  setTooltip({ x: svgX, y: svgY, region: r });
                }}
                onMouseLeave={() => setTooltip(null)}
              />
              {isPlayer && (
                <path
                  d={path}
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth="2"
                  strokeDasharray="6 3"
                  pointerEvents="none"
                  opacity="0.6"
                />
              )}
            </g>
          );
        })}

        {regions.map((r) => {
          const coords = JSON.parse(r.geometry) as number[][];
          const [cx, cy] = polygonCentroid(coords);
          return (
            <text
              key={`label-${r.regionId}`}
              x={cx}
              y={cy}
              textAnchor="middle"
              fontSize="8"
              fill="#ffffff"
              opacity="0.7"
              pointerEvents="none"
              fontFamily="sans-serif"
            >
              {r.name}
            </text>
          );
        })}

        {points.map((p) => {
          const ownerColor = getColor(p.ownerCountryId);
          if (p.type === "capital") {
            const size = 6;
            const points5 = [];
            for (let i = 0; i < 10; i++) {
              const r = i % 2 === 0 ? size : size * 0.4;
              const angle = (Math.PI / 5) * i - Math.PI / 2;
              points5.push(
                `${p.coordX + r * Math.cos(angle)},${p.coordY + r * Math.sin(angle)}`
              );
            }
            return (
              <g key={p.pointId}>
                <polygon
                  points={points5.join(" ")}
                  fill="#fbbf24"
                  stroke="#000"
                  strokeWidth="0.5"
                  filter="url(#glow)"
                />
                <text
                  x={p.coordX}
                  y={p.coordY + 14}
                  textAnchor="middle"
                  fontSize="7"
                  fill="#fbbf24"
                  fontWeight="bold"
                  fontFamily="sans-serif"
                >
                  {p.label}
                </text>
              </g>
            );
          }
          if (p.type === "city") {
            return (
              <g key={p.pointId}>
                <rect
                  x={p.coordX - 3}
                  y={p.coordY - 3}
                  width={6}
                  height={6}
                  fill="#e5e7eb"
                  stroke="#000"
                  strokeWidth="0.5"
                />
                <text
                  x={p.coordX}
                  y={p.coordY + 12}
                  textAnchor="middle"
                  fontSize="6"
                  fill="#e5e7eb"
                  fontFamily="sans-serif"
                >
                  {p.label}
                </text>
              </g>
            );
          }
          if (p.type === "battalion") {
            return (
              <g key={p.pointId}>
                <circle
                  cx={p.coordX}
                  cy={p.coordY}
                  r={4}
                  fill={ownerColor}
                  stroke="#000"
                  strokeWidth="1"
                />
                <line
                  x1={p.coordX - 5}
                  y1={p.coordY - 6}
                  x2={p.coordX + 5}
                  y2={p.coordY - 6}
                  stroke={ownerColor}
                  strokeWidth="1.5"
                />
                <line
                  x1={p.coordX}
                  y1={p.coordY - 6}
                  x2={p.coordX}
                  y2={p.coordY - 10}
                  stroke={ownerColor}
                  strokeWidth="1"
                />
                {p.label && (
                  <text
                    x={p.coordX}
                    y={p.coordY + 12}
                    textAnchor="middle"
                    fontSize="5"
                    fill="#d1d5db"
                    fontFamily="sans-serif"
                  >
                    {p.label}
                  </text>
                )}
              </g>
            );
          }
          return null;
        })}

        {tooltip && (
          <g>
            <rect
              x={tooltip.x + 10}
              y={tooltip.y - 30}
              width={140}
              height={40}
              rx={4}
              fill="#1f2937"
              stroke="#4b5563"
              strokeWidth="1"
              opacity={0.95}
            />
            <text
              x={tooltip.x + 18}
              y={tooltip.y - 14}
              fontSize="9"
              fill="#f3f4f6"
              fontWeight="bold"
              fontFamily="sans-serif"
            >
              {tooltip.region.name}
            </text>
            <text
              x={tooltip.x + 18}
              y={tooltip.y - 2}
              fontSize="7"
              fill="#9ca3af"
              fontFamily="sans-serif"
            >
              {tooltip.region.ownerCountryId
                ? countryMap.get(tooltip.region.ownerCountryId)?.name ??
                  "Неизвестно"
                : "Ничейная земля"}
            </text>
          </g>
        )}
      </svg>

      {selectedRegion && (
        <div className="absolute top-4 left-4 bg-gray-900/95 border border-gray-700 rounded-lg p-4 w-72 backdrop-blur-sm">
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-lg font-bold text-white">
              {selectedRegion.name}
            </h3>
            <button
              onClick={() => setSelectedRegion(null)}
              className="text-gray-400 hover:text-white text-lg"
            >
              ✕
            </button>
          </div>
          <div className="text-sm text-gray-300 space-y-1">
            <p>
              Тип:{" "}
              {selectedRegion.type === "land"
                ? "Суша"
                : selectedRegion.type === "coastal"
                  ? "Побережье"
                  : selectedRegion.type}
            </p>
            {selectedRegion.ownerCountryId && (
              <>
                <p className="flex items-center gap-2">
                  Владелец:{" "}
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{
                      backgroundColor: getColor(selectedRegion.ownerCountryId),
                    }}
                  />
                  {countryMap.get(selectedRegion.ownerCountryId)?.name}
                </p>
                <p>
                  Лидер:{" "}
                  {countryMap.get(selectedRegion.ownerCountryId)?.leaderName}
                </p>
                {(() => {
                  const stats = JSON.parse(
                    countryMap.get(selectedRegion.ownerCountryId)?.stats ||
                      "{}"
                  );
                  return (
                    <div className="mt-2 space-y-1">
                      {Object.entries(stats).map(([k, v]) => (
                        <div key={k} className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 w-20 capitalize">
                            {k === "economy"
                              ? "Экономика"
                              : k === "military"
                                ? "Армия"
                                : k === "stability"
                                  ? "Стабильн."
                                  : k}
                          </span>
                          <div className="flex-1 h-2 bg-gray-700 rounded-full">
                            <div
                              className="h-full rounded-full bg-blue-500"
                              style={{ width: `${v}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-400 w-6 text-right">
                            {String(v)}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </>
            )}
            {(() => {
              const regionPoints = points.filter(
                (p) => p.regionId === selectedRegion.regionId
              );
              if (regionPoints.length === 0) return null;
              return (
                <div className="mt-2 border-t border-gray-700 pt-2">
                  <p className="text-xs text-gray-400 mb-1">Объекты:</p>
                  {regionPoints.map((p) => (
                    <p key={p.pointId} className="text-xs">
                      {p.type === "capital"
                        ? "★"
                        : p.type === "city"
                          ? "■"
                          : "⚔"}{" "}
                      {p.label}
                      {p.strength > 0 && ` (${p.strength})`}
                    </p>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
