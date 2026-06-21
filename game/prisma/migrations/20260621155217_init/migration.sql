-- CreateTable
CREATE TABLE "Preset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "simulationRules" TEXT NOT NULL DEFAULT '',
    "worldLore" TEXT NOT NULL DEFAULT '',
    "defaultDifficulty" TEXT NOT NULL DEFAULT 'normal'
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "presetId" TEXT NOT NULL,
    "playerCountryId" TEXT NOT NULL,
    "currentDate" TEXT NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 1,
    "aiModel" TEXT NOT NULL DEFAULT 'stub',
    "difficulty" TEXT NOT NULL DEFAULT 'normal',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Game_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "Preset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Region" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "presetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'land',
    "geometry" TEXT NOT NULL,
    "ownerCountryId" TEXT,
    "neighborIds" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "Region_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "Preset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GameRegion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'land',
    "geometry" TEXT NOT NULL,
    "ownerCountryId" TEXT,
    "neighborIds" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "GameRegion_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Country" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "presetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "flag" TEXT NOT NULL DEFAULT '',
    "capitalRegionId" TEXT,
    "leaderName" TEXT NOT NULL DEFAULT '',
    "stats" TEXT NOT NULL DEFAULT '{}',
    "relations" TEXT NOT NULL DEFAULT '{}',
    CONSTRAINT "Country_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "Preset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GameCountry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "flag" TEXT NOT NULL DEFAULT '',
    "capitalRegionId" TEXT,
    "leaderName" TEXT NOT NULL DEFAULT '',
    "stats" TEXT NOT NULL DEFAULT '{}',
    "relations" TEXT NOT NULL DEFAULT '{}',
    CONSTRAINT "GameCountry_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Point" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "presetId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "coordX" REAL NOT NULL,
    "coordY" REAL NOT NULL,
    "ownerCountryId" TEXT,
    "label" TEXT NOT NULL DEFAULT '',
    "strength" INTEGER NOT NULL DEFAULT 0,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Point_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "Preset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GamePoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "pointId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "coordX" REAL NOT NULL,
    "coordY" REAL NOT NULL,
    "ownerCountryId" TEXT,
    "label" TEXT NOT NULL DEFAULT '',
    "strength" INTEGER NOT NULL DEFAULT 0,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "GamePoint_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "appliedDeltas" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "Event_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Action" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    CONSTRAINT "Action_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatThread" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'bilateral',
    "participantCountryIds" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "ChatThread_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "threadId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "speakerCountryId" TEXT,
    "text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ChatThread" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConsolidationSummary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "fromRound" INTEGER NOT NULL,
    "toRound" INTEGER NOT NULL,
    "summaryText" TEXT NOT NULL,
    CONSTRAINT "ConsolidationSummary_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
