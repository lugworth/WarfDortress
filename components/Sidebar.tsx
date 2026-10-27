'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useGame } from './GameProvider';
import {
  DwarfLabor,
  LaborPresetId,
  MilitiaDoctrine,
  MilitiaSquadId,
} from '@/lib/types';
import { QUIRKS } from '@/lib/guild';
import {
  getBuildingTileFunctionInfo,
  getResourceEconomyBalance,
  scanWorldStrata,
} from '@/lib/game-engine';
import { formatCost } from '@/lib/tool-catalog';
import { asciiBar } from '@/lib/ui-model';
import { getSentimentBadge } from '@/lib/thoughts';
import { playTactileSfx } from '@/lib/audio';
import { ensureMilitiaState, getDwarfSquad } from '@/lib/militia';
import ExpeditionsPanel from './ExpeditionsPanel';

const ALL_LABORS: DwarfLabor[] = [
  'MINING',
  'WOODCUTTING',
  'MASONRY',
  'CARPENTRY',
  'FARMING',
  'SMITHING',
  'COMBAT',
  'HAULING',
];

export type SidebarTab = 'PROGRESSION' | 'DWARVES' | 'STOCKS' | 'RADAR';

export default function Sidebar({ activeTab, onTabChange }: { activeTab: SidebarTab; onTabChange: (tab: SidebarTab) => void }) {
  const {
    gameState,
    progression,
    currentZ,
    setCurrentZ,
    selectedTool,
    setSelectedTool,
    setInspectMode,
    selectedDwarfId,
    setSelectedDwarfId,
    toggleDwarfLabor,
    applyPreset,
    setMilitiaDoctrine,
    triggerGoblinRaid,
    addWorkOrder,
    toggleWorkOrderAutoRepeat,
    removeWorkOrder,
    jumpToLocation,
    performExpeditionAction,
    claimMilestone,
    startStrangeMood,
    completeStrangeMood,
    activateBuildingFunction,
    dispatchMilitiaAction,
    triggerAIRaidAnalysis,
  } = useGame();

  const [buildingActionStatus, setBuildingActionStatus] = useState<string>('');
  const [militiaActionStatus, setMilitiaActionStatus] = useState<string>('');
  const [aiAnalyzeBusy, setAiAnalyzeBusy] = useState<boolean>(false);



  const radarCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const strataSummaries = useMemo(() => activeTab === 'RADAR' ? scanWorldStrata(gameState) : [], [activeTab, gameState]);
  const claimableCount = progression.milestones.filter(
    (m) => m.completed && !m.claimed
  ).length + (progression.canFulfillMood ? 1 : 0);

  // Draw Mini-Map Radar when RADAR tab is active
  useEffect(() => {
    if (activeTab !== 'RADAR') return;
    const canvas = radarCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = gameState.world.width;
    const h = gameState.world.height;
    const scale = 4;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w * scale, h * scale);

    const levelGrid = gameState.grid[currentZ];
    if (!levelGrid) return;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const tile = levelGrid[y]?.[x];
        if (!tile || !tile.revealed) {
          ctx.fillStyle = '#070707';
          ctx.fillRect(x * scale, y * scale, scale, scale);
          continue;
        }
        if (tile.terrain === 'CAVERN_RELIC') {
          ctx.fillStyle = '#00ffff';
        } else if (tile.terrain === 'GOLD_VEIN' || tile.terrain === 'MITHRIL_VEIN') {
          ctx.fillStyle = '#ff0099';
        } else if (tile.terrain === 'IRON_VEIN' || tile.terrain === 'COPPER_VEIN') {
          ctx.fillStyle = '#ff9900';
        } else if (tile.terrain === 'WATER') {
          ctx.fillStyle = '#0066ff';
        } else if (tile.terrain === 'MAGMA') {
          ctx.fillStyle = '#ff0000';
        } else if (tile.terrain.endsWith('_WALL')) {
          ctx.fillStyle = '#252525';
        } else if (
          tile.terrain.startsWith('WORKSHOP_') ||
          tile.terrain === 'TAVERN_HALL' ||
          tile.terrain === 'TEMPLE_ALTAR' ||
          tile.terrain === 'TRADE_DEPOT'
        ) {
          ctx.fillStyle = '#cc00ff';
        } else {
          ctx.fillStyle = '#141414';
        }
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }

    // Draw Dwarves on current Z
    for (const d of gameState.dwarves) {
      if (d.z === currentZ) {
        ctx.fillStyle = '#33ff00';
        ctx.fillRect(d.x * scale, d.y * scale, scale + 1, scale + 1);
      }
    }

    // Draw Hostiles on current Z
    for (const host of gameState.hostiles) {
      if (host.z === currentZ) {
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(host.x * scale, host.y * scale, scale + 1, scale + 1);
      }
    }
  }, [activeTab, gameState, currentZ]);

  const handleRadarClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = radarCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = gameState.world.width / rect.width;
    const scaleY = gameState.world.height / rect.height;
    const gx = Math.max(
      0,
      Math.min(gameState.world.width - 1, Math.floor((e.clientX - rect.left) * scaleX))
    );
    const gy = Math.max(
      0,
      Math.min(gameState.world.height - 1, Math.floor((e.clientY - rect.top) * scaleY))
    );
    jumpToLocation(gx, gy, currentZ);
  };

  return (
    <aside className="w-full h-full bg-[var(--ui-panel)] flex flex-col font-mono text-xs select-none overflow-hidden text-[var(--ui-text)]">
      {/* Top 4-Tab Selector */}
      <div className="sidebar-tabs border-b border-[var(--ui-border)] bg-[var(--ui-bg)] shrink-0">
        {(
          [
            { id: 'DWARVES', label: `Clan (${gameState.dwarves.length})` },
            {
              id: 'PROGRESSION',
              label: claimableCount > 0 ? `Quests (${claimableCount}!)` : 'Quests',
            },
            { id: 'STOCKS', label: 'Stocks' },
            { id: 'RADAR', label: 'Radar' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            aria-pressed={activeTab === tab.id}
            className={`py-2 px-0.5 text-center transition-colors border-r border-[var(--ui-border)] last:border-r-0 whitespace-nowrap flex items-center justify-center shrink-0 text-[11px] ${
              activeTab === tab.id
                ? 'bg-[var(--ui-panel)] text-[var(--ui-accent)] font-bold border-b-2 border-b-[var(--ui-accent)]'
                : tab.id === 'PROGRESSION' && claimableCount > 0
                  ? 'text-[#33ff00] font-bold hover:text-[#ffffff]'
                  : 'text-[var(--ui-muted)] hover:text-[var(--ui-text)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content Area */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
        {activeTab === 'PROGRESSION' && (
          <div className="space-y-3" data-testid="progression-panel">
            <section className="mountainhome-goal" aria-label="Mountainhome goal">
              <h2>{progression.score >= 25000 ? 'Mountainhome Capital reached' : 'Your goal: build a Mountainhome'}</h2>
              <p>Reach 25,000 fortress score through wealth, population, workshops, deeper exploration, and relics.</p>
              <progress aria-label="Mountainhome progress" value={Math.min(25000, progression.score)} max={25000} />
              <strong>{progression.score.toLocaleString()} / 25,000 fortress score</strong>
              <p>Claim completed milestones below to earn supplies, migrants, and artifacts.</p>
            </section>
            {/* 1. Fortress Sovereignty Rank Card */}
            <div
              data-testid="fortress-rank-card"
              className="p-2.5 bg-[var(--ui-bg)] border border-[var(--ui-accent)] space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[var(--ui-accent)] font-bold text-xs whitespace-nowrap truncate">
                  * TIER {progression.currentRank.tier}:{' '}
                  {progression.currentRank.title.toUpperCase()}
                </span>
                <span className="text-[#00ffff] text-[10px] tabular-nums font-bold shrink-0">
                  SCORE {progression.score}
                </span>
              </div>

              <div className="text-[10px] text-[var(--ui-muted)]">
                Dwarven Charter: <span className="text-[#d0d0d0]">{progression.currentRank.dwarvenTitle}</span>
              </div>
              <div className="text-[11px] text-[#33ff00]">
                {progression.currentRank.perk}
              </div>
              {progression.nextRank ? (
                <div className="pt-1 border-t border-[var(--ui-border)] space-y-0.5 text-[10px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--ui-muted)]">
                      Next: <strong className="text-[#ffffff]">{progression.nextRank.title}</strong>
                    </span>
                    <span className="text-[#ff9900] tabular-nums">
                      {asciiBar(progression.rankProgressPercent, 100, 8)}{' '}
                      {progression.rankProgressPercent}%
                    </span>
                  </div>
                  <div className="text-[var(--ui-muted)]">
                    Unlocks at Score {progression.nextRank.minScore}
                  </div>
                </div>
              ) : (
                <div className="pt-1 border-t border-[var(--ui-border)] text-[10px] text-[#ff0099] font-bold">
                  [ SOVEREIGN MOUNTAINHOME CAPITAL ACHIEVED ]
                </div>
              )}
            </div>

            {/* 2. Strange Mood & Masterwork Artifact System */}
            <div
              data-testid="strange-mood-card"
              className="p-2.5 bg-[var(--ui-bg)] border border-[#cc00ff] space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[#cc00ff] font-bold text-xs">
                  ☼ STRANGE MOOD &amp; ARTIFACTS
                </span>
                <span className="text-[10px] text-[var(--ui-muted)] tabular-nums">
                  VAULT: {gameState.guild.relics.length}
                </span>
              </div>

              {progression.strangeMood ? (
                <div className="space-y-1.5 text-[11px]">
                  <div className="text-[#ffffff] font-bold">
                    {progression.strangeMood.dwarfName} ({progression.strangeMood.moodKind} MOOD)
                  </div>
                  <div className="text-[#00ffff] text-[10px]">
                    Forging: &ldquo;{progression.strangeMood.artifactName}&rdquo;
                  </div>
                  <div className="text-[#ff9900] text-[10px] tabular-nums">
                    Demands: {formatCost(progression.strangeMood.demands)} ·{' '}
                    {Math.max(0, progression.strangeMood.deadline - gameState.ticks)}T left
                  </div>
                  <button
                    type="button"
                    disabled={!progression.canFulfillMood}
                    onClick={() => {
                      playTactileSfx('stamp');
                      completeStrangeMood();
                    }}
                    className="w-full py-1 px-2 border border-[#33ff00] bg-[#0a200a] text-[#33ff00] font-bold text-[11px] disabled:opacity-40"
                  >
                    [ ☼ FULFILL MOOD &amp; FORGE ARTIFACT ]
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5 text-[10px] text-[var(--ui-muted)]">
                  <p>
                    Inspire a skilled artisan to claim a workshop and forge a named
                    Legendary Artifact (+350 Wealth &amp; Relic Blessing).
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      playTactileSfx('tool');
                      startStrangeMood();
                    }}
                    className="w-full py-1 px-2 border border-[#cc00ff] text-[#cc00ff] hover:bg-[#1e0a24] font-bold text-[11px]"
                  >
                    [ ☼ INSPIRE STRANGE MOOD ]
                  </button>
                </div>
              )}
            </div>

            {/* 2b. Architectural Blueprints & Building Unlock Progression */}
            <div className="space-y-1.5" data-testid="building-unlocks-list">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#ff9900] font-bold text-xs whitespace-nowrap">
                  +-[ TECH TREE &amp; BLUEPRINTS ]-
                </span>
                <span className="text-[10px] text-[#00ffff] tabular-nums whitespace-nowrap shrink-0">
                  {progression.buildingUnlocks.filter((b) => b.tier > 0 && b.unlocked).length}/
                  {progression.buildingUnlocks.filter((b) => b.tier > 0).length} UNLOCKED
                </span>
              </div>
              <p className="text-[10px] text-[var(--ui-muted)]">
                Collect Stone, Wood, Iron Ore, and Steel Bars to unlock advanced workshops and halls.
              </p>
              <div className="space-y-1">
                {progression.buildingUnlocks
                  .filter((b) => b.tier > 0)
                  .map((b) => {
                    const isSelected = selectedTool === b.tool;
                    return (
                      <div
                        key={b.tool}
                        data-testid={`tech-unlock-${b.tool}`}
                        className={`p-1.5 border space-y-0.5 ${
                          b.unlocked
                            ? isSelected
                              ? 'border-[#ff0099] bg-[#201018]'
                              : 'border-[#1f3a1f] bg-[#071207]'
                            : 'border-[var(--ui-border)] bg-[var(--ui-bg)]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={`font-bold text-[11px] truncate ${
                              b.unlocked ? 'text-[#33ff00]' : 'text-[#d0d0d0]'
                            }`}
                          >
                            {b.unlocked ? `[+] ${b.glyph}` : `🔒 ${b.glyph}`} {b.title}
                          </span>
                          {b.unlocked ? (
                            <button
                              type="button"
                              onClick={() => {
                                playTactileSfx('tool');
                                setInspectMode(false);
                                setSelectedTool(b.tool);
                              }}
                              className="px-1.5 py-0.5 border border-[#33ff00] text-[#33ff00] hover:bg-[#123012] text-[9px] font-bold shrink-0"
                            >
                              {isSelected ? '[ ACTIVE ]' : '[ BUILD ]'}
                            </button>
                          ) : (
                            <span className="text-[9px] text-[#ff9900] tabular-nums shrink-0">
                              {asciiBar(b.progressPercent, 100, 5)} {b.progressPercent}%
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2 text-[10px]">
                          <span className="text-[var(--ui-muted)] truncate">
                            {b.unlocked ? `Cost: ${formatCost(b.cost)}` : b.requirementLabel}
                          </span>
                          {!b.unlocked && (
                            <span className="text-[#00ffff] tabular-nums shrink-0">
                              {b.progressText}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* 3. Interactive Fortress Milestones (Deeds) */}
            <div className="space-y-1.5" data-testid="milestones-list">
              <div className="text-[var(--ui-info)] font-bold text-xs whitespace-nowrap">
                +-[ FORTRESS MILESTONES &amp; DEEDS ]-
              </div>
              {progression.milestones.map((ms) => (
                <div
                  key={ms.id}
                  className={`p-2 border space-y-1 ${
                    ms.claimed
                      ? 'border-[#1f3a1f] bg-[#060d06] opacity-80'
                      : ms.completed
                        ? 'border-[#33ff00] bg-[#091809]'
                        : 'border-[var(--ui-border)] bg-[var(--ui-bg)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-[#ffffff] text-[11px]">
                      {ms.claimed ? '[+] ' : ms.completed ? '[*] ' : '· '}
                      {ms.title}
                    </span>

                    <span className="text-[10px] tabular-nums text-[#00ffff]">
                      {ms.progress}/{ms.target}
                    </span>
                  </div>
                  <p className="text-[10px] text-[var(--ui-muted)] leading-snug">
                    {ms.description}
                  </p>
                  <div className="text-[10px] text-[#ff9900]">
                    Reward: {ms.rewardSummary}
                  </div>
                  {ms.completed && !ms.claimed && (
                    <button
                      type="button"
                      onClick={() => {
                        playTactileSfx('stamp');
                        claimMilestone(ms.id);
                      }}
                      className="w-full mt-1 py-1 px-2 border border-[#33ff00] bg-[#0d260d] text-[#33ff00] font-bold text-[11px] hover:bg-[#163d16]"
                    >
                      [ ★ CLAIM MILESTONE REWARD ]
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* 4. External Caravan & Scouting Expeditions */}
            <div className="pt-2 border-t border-[var(--ui-border)] space-y-1.5">
              <div className="text-[var(--ui-accent)] font-bold text-xs">
                +-[ EXTERNAL SCOUTING EXPEDITIONS ]-
              </div>
              <ExpeditionsPanel
                state={gameState}
                onAction={performExpeditionAction}
              />
            </div>
          </div>
        )}

        {activeTab === 'DWARVES' && (() => {
          const militia = ensureMilitiaState(gameState);
          const squadsList = Object.values(militia.squads);
          const activeSquad =
            militia.squads[militia.activeSquadId] || squadsList[0];
          const activeSquadMembers = gameState.dwarves.filter(
            (d) =>
              d.squadId === activeSquad.id ||
              activeSquad.memberIds.includes(d.id)
          );
          const cx = Math.floor(gameState.world.width / 2);
          const cy = Math.floor(gameState.world.height / 2);
          const vanquishedCount = militia.battleLog.filter(
            (b) => b.outcome === 'VANQUISHED' || b.outcome === 'TRAP_CRUSH'
          ).length;

          return (
          <div className="space-y-2.5">
            {/* Dwarven Militia Squads & AI Goblin Raid Command Box */}
            <details
              data-testid="militia-command-panel"
              className="p-2 bg-[var(--ui-bg)] border border-[var(--ui-danger)]/70 space-y-2"
            >
              <summary className="flex items-center justify-between gap-3 text-[11px]">
                <span className="text-[var(--ui-danger)] font-bold">
                  Militia & defense +
                </span>
                <span className="text-[var(--ui-muted)] tabular-nums">
                  HOSTILES:{' '}
                  <strong className="text-[var(--ui-danger)]">
                    {gameState.hostiles.length}
                  </strong>{' '}
                  · SLAIN:{' '}
                  <strong className="text-[#33ff00]">
                    {vanquishedCount}
                  </strong>
                </span>
              </summary>

              {/* Global Doctrine Selector */}
              <div className="button-grid">
                {(
                  [
                    { id: 'DEFENSIVE', label: 'Defend' },
                    { id: 'PATROL', label: 'Patrol' },
                    { id: 'SALLY_FORTH', label: 'Sally' },
                  ] as { id: MilitiaDoctrine; label: string }[]
                ).map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => setMilitiaDoctrine(doc.id)}
                    className={`py-1 px-1 text-[10px] border text-center whitespace-nowrap shrink-0 transition-colors ${
                      gameState.militiaDoctrine === doc.id
                        ? 'border-[var(--ui-danger)] bg-[var(--ui-border)] text-[var(--ui-danger)] font-bold'
                        : 'border-[var(--ui-border)] text-[var(--ui-muted)] hover:text-[var(--ui-bright)]'
                    }`}
                  >
                    {doc.label}
                  </button>
                ))}
              </div>

              {/* Squad Selector Tabs (Shield-1 & Watch-2) */}
              <div className="pt-1 border-t border-[var(--ui-border)] space-y-1.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-[#ff9900] font-bold">
                    ACTIVE SQUAD ROSTER
                  </span>
                  <span className="text-[var(--ui-muted)]">
                    Click tile with ♦/» tool
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {squadsList.map((sq) => {
                    const count = gameState.dwarves.filter(
                      (d) => d.squadId === sq.id || sq.memberIds.includes(d.id)
                    ).length;
                    const isSel = sq.id === activeSquad.id;
                    return (
                      <button
                        key={sq.id}
                        type="button"
                        data-testid={`select-${sq.id}-btn`}
                        onClick={() => {
                          playTactileSfx('tool');
                          const res = dispatchMilitiaAction({
                            type: 'SELECT_SQUAD',
                            squadId: sq.id,
                          });
                          setMilitiaActionStatus(res.message);
                        }}
                        className={`p-1.5 border text-left transition-colors ${
                          isSel
                            ? 'border-[#ff0099] bg-[#1e0d18] text-[#ffffff]'
                            : 'border-[var(--ui-border)] bg-[var(--ui-panel)] text-[var(--ui-muted)] hover:text-[#ffffff]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 text-[10px] font-bold">
                          <span style={{ color: sq.color }}>
                            [{sq.glyph}] {sq.callsign}
                          </span>
                          <span className="tabular-nums text-[#00ffff]">
                            {count} DWF
                          </span>
                        </div>
                        <div className="text-[9px] text-[var(--ui-muted)] truncate mt-0.5">
                          {sq.order.label}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Active Squad Details & Orders (Map Designate or Quick Order) */}
                <div
                  data-testid="active-squad-orders"
                  className="p-1.5 bg-[var(--ui-panel)] border border-[var(--ui-border)] space-y-1.5 text-[10px]"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-[#ffffff] truncate">
                      <span style={{ color: activeSquad.color }}>
                        {activeSquad.glyph}
                      </span>{' '}
                      {activeSquad.name} ({activeSquadMembers.length})
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        jumpToLocation(
                          activeSquad.order.x,
                          activeSquad.order.y,
                          activeSquad.order.z
                        )
                      }
                      className="px-1 border border-[var(--ui-border)] text-[#00ffff] hover:text-[#ffffff] shrink-0"
                    >
                      [Z-{activeSquad.order.z}]
                    </button>
                  </div>
                  <div className="text-[9px] text-[#33ff00] truncate">
                    ORDER: {activeSquad.order.label}
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      data-testid="squad-map-station-tool-btn"
                      onClick={() => {
                        playTactileSfx('tool');
                        setInspectMode(false);
                        setSelectedTool('MILITIA_STATION');
                        setMilitiaActionStatus(
                          `Selected [♦ Station Tool] for ${activeSquad.callsign} — click/drag any map tile.`
                        );
                      }}
                      className={`py-1 px-1.5 border font-bold text-center whitespace-nowrap ${
                        selectedTool === 'MILITIA_STATION'
                          ? 'border-[#ff0099] bg-[#24101c] text-[#ffffff]'
                          : 'border-[#ff0000]/70 text-[#ff0000] hover:bg-[var(--ui-border)]'
                      }`}
                    >
                      [ ♦ Map Station (J) ]
                    </button>
                    <button
                      type="button"
                      data-testid="squad-map-patrol-tool-btn"
                      onClick={() => {
                        playTactileSfx('tool');
                        setInspectMode(false);
                        setSelectedTool('MILITIA_PATROL');
                        setMilitiaActionStatus(
                          `Selected [» Patrol Tool] for ${activeSquad.callsign} — drag patrol route on map.`
                        );
                      }}
                      className={`py-1 px-1.5 border font-bold text-center whitespace-nowrap ${
                        selectedTool === 'MILITIA_PATROL'
                          ? 'border-[#ff0099] bg-[#24101c] text-[#ffffff]'
                          : 'border-[#00ffff]/70 text-[#00ffff] hover:bg-[var(--ui-border)]'
                      }`}
                    >
                      [ » Map Patrol (N) ]
                    </button>
                    <button
                      type="button"
                      data-testid="squad-quick-station-gate-btn"
                      onClick={() => {
                        playTactileSfx('stamp');
                        const res = dispatchMilitiaAction({
                          type: 'ISSUE_SQUAD_ORDER',
                          squadId: activeSquad.id,
                          orderType: 'STATION',
                          x: cx - 5,
                          y: cy,
                          z: currentZ,
                        });
                        setMilitiaActionStatus(res.message);
                      }}
                      className="py-1 px-1 border border-[var(--ui-border)] text-[#ff9900] hover:border-[#ff9900] text-center whitespace-nowrap"
                    >
                      [ Station Gate ]
                    </button>
                    <button
                      type="button"
                      data-testid="squad-quick-patrol-perimeter-btn"
                      onClick={() => {
                        playTactileSfx('stamp');
                        const res = dispatchMilitiaAction({
                          type: 'ISSUE_SQUAD_ORDER',
                          squadId: activeSquad.id,
                          orderType: 'PATROL',
                          x: Math.max(3, cx - 10),
                          y: cy - 3,
                          z: currentZ,
                          x2: Math.min(gameState.world.width - 4, cx + 10),
                          y2: cy + 3,
                        });
                        setMilitiaActionStatus(res.message);
                      }}
                      className="py-1 px-1 border border-[var(--ui-border)] text-[#33ff00] hover:border-[#33ff00] text-center whitespace-nowrap"
                    >
                      [ Patrol Gate ]
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      data-testid="squad-equip-armory-btn"
                      onClick={() => {
                        playTactileSfx('stamp');
                        const res = dispatchMilitiaAction({
                          type: 'EQUIP_SQUAD_ARMORY',
                          squadId: activeSquad.id,
                        });
                        setMilitiaActionStatus(res.message);
                      }}
                      className="flex-1 py-0.5 px-1 border border-[#00ffff]/60 text-[#00ffff] hover:bg-[var(--ui-border)] text-[9px] font-bold"
                    >
                      [ ⚒ Equip Squad ({gameState.resources.weapons}⚔/{gameState.resources.armor}🛡) ]
                    </button>
                    <button
                      type="button"
                      data-testid="squad-clear-order-btn"
                      onClick={() => {
                        const res = dispatchMilitiaAction({
                          type: 'ISSUE_SQUAD_ORDER',
                          squadId: activeSquad.id,
                          orderType: 'FOLLOW_DOCTRINE',
                          x: cx,
                          y: cy,
                          z: currentZ,
                        });
                        setMilitiaActionStatus(res.message);
                      }}
                      className="py-0.5 px-1.5 border border-[var(--ui-border)] text-[var(--ui-muted)] hover:text-[#ffffff] text-[9px]"
                    >
                      [Auto]
                    </button>
                  </div>
                </div>
              </div>

              {/* AI Goblin Raid Tactical Dispatch & War Horn */}
              {militia.activeRaidPlan && (
                <div
                  data-testid="ai-raid-battle-plan"
                  className="p-1.5 bg-[#160608] border border-[#ff0000]/70 space-y-1 text-[10px]"
                >
                  <div className="flex items-center justify-between gap-1 text-[#ff0000] font-bold">
                    <span>[ ! {militia.activeRaidPlan.warlordName} ]</span>
                    <span className="text-[#ff9900] text-[9px]">
                      {militia.activeRaidPlan.tactic} · {militia.activeRaidPlan.threatLevel}
                    </span>
                  </div>
                  <p className="text-[#d0d0d0] italic leading-snug text-[9px]">
                    &ldquo;{militia.activeRaidPlan.warlordQuote.replace(/^["“]+|["”]+$/g, '')}&rdquo;
                  </p>
                  <div className="text-[#00ffff] text-[9px] leading-snug">
                    AI Counter: {militia.activeRaidPlan.recommendedCounter}
                  </div>
                </div>
              )}

              {militiaActionStatus && (
                <div
                  data-testid="militia-action-status"
                  className="text-[9px] text-[#ff9900] bg-[#140e04] border border-[#ff9900]/40 px-1.5 py-1"
                >
                  {militiaActionStatus}
                </div>
              )}

              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  data-testid="ai-tactical-brief-btn"
                  disabled={aiAnalyzeBusy}
                  onClick={async () => {
                    setAiAnalyzeBusy(true);
                    const res = await triggerAIRaidAnalysis(false);
                    setMilitiaActionStatus(res.message);
                    setAiAnalyzeBusy(false);
                  }}
                  className="py-1 px-1.5 border border-[#00ffff] text-[#00ffff] hover:bg-[var(--ui-border)] text-[10px] font-bold text-center whitespace-nowrap disabled:opacity-50"
                >
                  {aiAnalyzeBusy ? 'Scouting...' : '⚔ AI Raid Brief'}
                </button>
                <button
                  type="button"
                  data-testid="sound-war-horn-btn"
                  onClick={triggerGoblinRaid}
                  className="py-1 px-1.5 border border-[var(--ui-warning)] text-[var(--ui-warning)] hover:bg-[var(--ui-border)] hover:text-[var(--ui-bright)] text-[10px] font-bold text-center whitespace-nowrap"
                >
                  Sound war horn
                </button>
              </div>
            </details>

            {/* Clan-Wide Labor Presets */}
            <div className="p-2 bg-[var(--ui-bg)] border border-[var(--ui-border)] space-y-1.5">
              <div className="text-[11px] text-[var(--ui-info)] font-bold">
                CLAN-WIDE LABOR PRESETS (ONE-CLICK)
              </div>
              <div className="button-grid">
                {(
                  [
                    { id: 'ALL_HANDS', label: 'All hands', color: 'text-[var(--ui-success)]' },
                    { id: 'MINING_DELVE', label: 'Miners', color: 'text-[var(--ui-warning)]' },
                    { id: 'SMITH_FORTIFY', label: 'Smiths', color: 'text-[var(--ui-info)]' },
                    { id: 'HARVEST_BREW', label: 'Farmers', color: 'text-[var(--ui-violet)]' },
                  ] as { id: LaborPresetId; label: string; color: string }[]
                ).map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset.id)}
                    className={`py-1 px-1.5 border border-[var(--ui-border)] bg-[var(--ui-panel)] hover:bg-[var(--ui-border)] text-[10px] font-bold whitespace-nowrap shrink-0 ${preset.color}`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Individual Dwarf Roster */}
            {gameState.dwarves.map((dwarf) => {
              const isSelected = selectedDwarfId === dwarf.id;
              return (
                <div
                  key={dwarf.id}
                  onClick={() => setSelectedDwarfId(dwarf.id)}
                  className={`p-2 border cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[var(--ui-border)] border-[var(--ui-accent)]'
                      : 'bg-[var(--ui-bg)] border-[var(--ui-border)] hover:border-[var(--ui-muted)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="font-bold text-[var(--ui-bright)] flex items-center gap-1.5 min-w-0">
                      <span style={{ color: dwarf.color }}>{dwarf.char}</span>
                      <span className="truncate">{dwarf.name}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          jumpToLocation(dwarf.x, dwarf.y, dwarf.z);
                        }}
                        className="text-[10px] text-[var(--ui-info)] hover:text-[var(--ui-bright)] px-1 border border-[var(--ui-border)] whitespace-nowrap shrink-0"
                      >
                        [Z-{dwarf.z}]
                      </button>
                    </div>
                  </div>

                  <div className="text-[11px] text-[var(--ui-info)] mt-0.5 flex items-center justify-between gap-1">
                    <span className="truncate">
                      {dwarf.title} {'//'} <span className="text-[var(--ui-success)]">{dwarf.state}</span>
                    </span>
                    <span className="text-[10px] tabular-nums flex items-center gap-1 shrink-0">
                      {dwarf.weaponEquipped && (
                        <span className="text-[var(--ui-warning)] whitespace-nowrap shrink-0" title="Runed Battle Axe Equipped">
                          [⚔AXE]
                        </span>
                      )}
                      {dwarf.armorEquipped && (
                        <span className="text-[var(--ui-info)] whitespace-nowrap shrink-0" title="Steel Plate Mail Equipped">
                          [🛡MAIL]
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Vital Needs & HP Readout with ASCII Block Gauges */}
                  <div className="mt-2 space-y-1 text-[10px] tabular-nums bg-[var(--ui-panel)] p-1.5 border border-[var(--ui-border)]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[var(--ui-muted)]">HP</span>
                      <span className={dwarf.hp < 50 ? 'text-[var(--ui-danger)]' : 'text-[var(--ui-success)]'}>
                        {asciiBar(dwarf.hp, dwarf.maxHp, 6)} {dwarf.hp}/{dwarf.maxHp}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[var(--ui-muted)]">ALE</span>
                      <span className={dwarf.thirst < 30 ? 'text-[var(--ui-danger)]' : 'text-[var(--ui-violet)]'}>
                        {asciiBar(dwarf.thirst, 100, 6)} {Math.round(dwarf.thirst)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[var(--ui-muted)]">MIRTH</span>
                      <span className="text-[var(--ui-accent)]">
                        {asciiBar(dwarf.happiness, 100, 6)} {Math.round(dwarf.happiness)}%
                      </span>
                    </div>
                  </div>

                  {dwarf.quirk && <p className="mt-1 text-xs text-[var(--ui-accent)]" title={QUIRKS[dwarf.quirk].description}>{QUIRKS[dwarf.quirk].name}</p>}
                  {/* Automated Thoughts & Feelings Log */}
                  <div
                    data-testid={`dwarf-thought-log-${dwarf.id}`}
                    className="mt-1.5 p-1.5 bg-[var(--ui-panel)] border border-[var(--ui-border)]/70 space-y-1"
                  >
                    <div className="flex items-center justify-between text-[9px] text-[#ff0099] font-bold">
                      <span>THOUGHTS &amp; FEELINGS</span>
                      <span className="text-[var(--ui-muted)] tabular-nums">
                        {(dwarf.thoughtLog?.length || 1)} MEMORIES
                      </span>
                    </div>
                    {(dwarf.thoughtLog && dwarf.thoughtLog.length > 0
                      ? dwarf.thoughtLog.slice(0, isSelected ? 4 : 2)
                      : [
                          {
                            id: `fallback-${dwarf.id}`,
                            tick: 0,
                            year: gameState.year,
                            season: gameState.season,
                            text: dwarf.thought,
                            category: 'CRAFT_DELVE' as const,
                            sentiment: 'POSITIVE' as const,
                            moraleDelta: 0,
                          },
                        ]
                    ).map((entry) => {
                      const badge = getSentimentBadge(entry.sentiment);
                      return (
                        <div
                          key={entry.id}
                          className="text-[10px] leading-snug flex items-start justify-between gap-1 border-b border-[var(--ui-border)]/40 last:border-b-0 pb-0.5 last:pb-0"
                        >
                          <span className="text-[var(--ui-text)] italic">
                            <span className={`${badge.colorClass} not-italic font-bold mr-1`}>
                              {badge.glyph}
                            </span>
                            &ldquo;{entry.text}&rdquo;
                          </span>
                          {entry.moraleDelta !== 0 && (
                            <span
                              className={`text-[9px] tabular-nums shrink-0 font-bold ${
                                entry.moraleDelta > 0 ? 'text-[#33ff00]' : 'text-[#ff0000]'
                              }`}
                            >
                              {entry.moraleDelta > 0
                                ? `+${entry.moraleDelta}`
                                : entry.moraleDelta}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Squad Assignment Bar */}
                  <div className="mt-2 pt-1.5 border-t border-[var(--ui-border)] flex items-center justify-between gap-1">
                    <span className="text-[10px] text-[var(--ui-muted)] shrink-0">
                      SQUAD:
                    </span>
                    <div className="flex items-center gap-1">
                      {(
                        [
                          { id: null, label: 'None', color: 'text-[var(--ui-muted)]' },
                          { id: 'squad-1', label: '♦Shield-1', color: 'text-[#ff5555]' },
                          { id: 'squad-2', label: '»Watch-2', color: 'text-[#00ffff]' },
                        ] as Array<{ id: MilitiaSquadId | null; label: string; color: string }>
                      ).map((opt) => {
                        const active = (dwarf.squadId ?? null) === opt.id;
                        return (
                          <button
                            key={opt.label}
                            type="button"
                            data-testid={`assign-${dwarf.id}-${opt.id ?? 'none'}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              playTactileSfx('tool');
                              const res = dispatchMilitiaAction({
                                type: 'ASSIGN_DWARF_SQUAD',
                                dwarfId: dwarf.id,
                                squadId: opt.id,
                              });
                              setMilitiaActionStatus(res.message);
                            }}
                            className={`px-1.5 py-0.5 text-[9px] border transition-colors whitespace-nowrap ${
                              active
                                ? `border-[#ff0099] bg-[#22101a] font-bold ${opt.color}`
                                : 'border-[var(--ui-border)] text-[var(--ui-muted)] hover:text-[#ffffff]'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Labor Toggles (8 Labors) */}
                  <div className="mt-2 pt-1.5 border-t border-[var(--ui-border)]">
                    <div className="text-[10px] text-[var(--ui-muted)] mb-1">ASSIGNED LABORS:</div>
                    <div className="flex flex-wrap gap-1">
                      {ALL_LABORS.map((labor) => {
                        const active = dwarf.labors[labor];
                        return (
                          <button
                            key={labor}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleDwarfLabor(dwarf.id, labor);
                            }}
                            className={`px-1 py-0.5 text-[10px] border transition-colors whitespace-nowrap shrink-0 ${
                              active
                                ? 'border-[var(--ui-success)] text-[var(--ui-success)] bg-[var(--ui-panel)]'
                                : 'border-[var(--ui-border)] text-[var(--ui-muted)]'
                            }`}
                          >
                            [{active ? 'X' : ' '} {labor.slice(0, 5)}]
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          );
        })()}

        {activeTab === 'STOCKS' && (
          <div className="space-y-3">
            {/* Full Stockpile & Armory Inventory */}
            <div className="bg-[var(--ui-bg)] border border-[var(--ui-border)] p-2.5">
              <div className="text-[var(--ui-accent)] font-bold border-b border-[var(--ui-border)] pb-1 mb-2 flex items-center justify-between">
                <span>FORTRESS VAULT &amp; ARMORY</span>
                <span className="text-[var(--ui-info)] tabular-nums">{gameState.resources.wealth} WLTH</span>
              </div>
              <div className="space-y-1 tabular-nums text-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--ui-muted)]">SMELTED STEEL BARS:</span>
                  <span className="text-[var(--ui-info)] font-bold">{gameState.resources.steelBars}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--ui-muted)]">RUNED WEAPONS (⚔):</span>
                  <span className="text-[var(--ui-warning)] font-bold">{gameState.resources.weapons}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--ui-muted)]">STEEL PLATE ARMOR (🛡):</span>
                  <span className="text-[var(--ui-success)] font-bold">{gameState.resources.armor}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--ui-muted)]">RECLAIMED RELICS (☼):</span>
                  <span className="text-[var(--ui-accent)] font-bold">{gameState.resources.relics}</span>
                </div>
                <div className="border-t border-[var(--ui-border)] my-1 pt-1 flex justify-between">
                  <span className="text-[var(--ui-muted)]">ROUGH STONE:</span>
                  <span className="text-[var(--ui-bright)] font-bold">{gameState.resources.stone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--ui-muted)]">TIMBER LOGS:</span>
                  <span className="text-[var(--ui-warning)] font-bold">{gameState.resources.wood}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--ui-muted)]">IRON ORE:</span>
                  <span className="text-[var(--ui-warning)] font-bold">{gameState.resources.ironOre}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--ui-muted)]">GOLD ORE:</span>
                  <span className="text-[var(--ui-accent)] font-bold">{gameState.resources.goldOre}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--ui-muted)]">PLUMP HELMET FOOD:</span>
                  <span className="text-[var(--ui-success)] font-bold">{gameState.resources.food}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--ui-muted)]">DWARVEN ALE:</span>
                  <span className="text-[var(--ui-violet)] font-bold">{gameState.resources.ale}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--ui-muted)]">CRAFTED FURNITURE:</span>
                  <span className="text-[var(--ui-info)] font-bold">{gameState.resources.furniture}</span>
                </div>
              </div>
            </div>

            {/* Provisions Balance & Stockpile Vault Capacity */}
            {(() => {
              const econ = getResourceEconomyBalance(gameState);
              const spoilageRisk = Math.max(
                0,
                gameState.resources.food - econ.maxSafeFoodStorage,
              );
              return (
                <div
                  data-testid="provisions-economy-card"
                  className="bg-[var(--ui-bg)] border border-[var(--ui-border)] p-2.5 space-y-1.5 text-xs"
                >
                  <div className="text-[var(--ui-success)] font-bold border-b border-[var(--ui-border)] pb-1 flex items-center justify-between">
                    <span>PROVISIONS &amp; STOCKPILE CAPACITY</span>
                    <span className="text-[10px] text-[var(--ui-info)] tabular-nums">
                      {econ.stockpileTiles} ≡ TILES ({econ.status})
                    </span>
                  </div>
                  <div className="space-y-1 tabular-nums text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-[var(--ui-muted)]">SAFE FOOD VAULT CAP:</span>
                      <span
                        className={
                          spoilageRisk > 0
                            ? 'text-[var(--ui-warning)] font-bold'
                            : 'text-[var(--ui-success)] font-bold'
                        }
                      >
                        {gameState.resources.food}/{econ.maxSafeFoodStorage}
                        {spoilageRisk > 0 ? ` (+${spoilageRisk} AT RISK)` : ' (SAFE)'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--ui-muted)]">SEASONAL FOOD BURN:</span>
                      <span className="text-[var(--ui-bright)]">
                        ~{econ.foodPerSeason}/season ({econ.foodRunwaySeasons} seasons left)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--ui-muted)]">SEASONAL ALE BURN:</span>
                      <span className="text-[var(--ui-violet)]">
                        ~{econ.alePerSeason}/season ({econ.aleRunwaySeasons} seasons left)
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Active Stockpile & Building Tile Actuators */}
            {(() => {
              const seenTypes = new Set<string>();
              const activeStructures: Array<{
                x: number;
                y: number;
                z: number;
                terrain: string;
                char: string;
                color: string;
                fn: NonNullable<ReturnType<typeof getBuildingTileFunctionInfo>>;
              }> = [];
              for (let z = 0; z < gameState.world.depth; z++) {
                const layer = gameState.grid[z];
                if (!layer) continue;
                for (let y = 0; y < gameState.world.height; y++) {
                  for (let x = 0; x < gameState.world.width; x++) {
                    const tile = layer[y]?.[x];
                    if (!tile || !tile.revealed || seenTypes.has(tile.terrain)) continue;
                    const fn = getBuildingTileFunctionInfo(gameState, tile);
                    if (fn) {
                      seenTypes.add(tile.terrain);
                      activeStructures.push({
                        x,
                        y,
                        z,
                        terrain: tile.terrain,
                        char: tile.char,
                        color: tile.fg,
                        fn,
                      });
                    }
                  }
                }
              }
              return (
                <div
                  data-testid="building-actuators-card"
                  className="bg-[var(--ui-bg)] border border-[var(--ui-border)] p-2.5 space-y-2 text-xs"
                >
                  <div className="text-[#00ffff] font-bold border-b border-[var(--ui-border)] pb-1 flex items-center justify-between">
                    <span>STOCKPILE &amp; BUILDING ACTUATORS</span>
                    <span className="text-[10px] text-[var(--ui-muted)]">
                      {activeStructures.length} TYPES
                    </span>
                  </div>
                  {buildingActionStatus && (
                    <div
                      data-testid="building-action-status"
                      className="p-1.5 bg-[#0a200a] border border-[#33ff00] text-[#33ff00] text-[10px]"
                    >
                      {buildingActionStatus}
                    </div>
                  )}
                  <div className="space-y-1.5 max-h-60 overflow-y-auto pr-0.5">
                    {activeStructures.map((item) => (
                      <div
                        key={`${item.terrain}-${item.x}-${item.y}-${item.z}`}
                        className="p-1.5 bg-[var(--ui-panel)] border border-[var(--ui-border)] space-y-1"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <button
                            type="button"
                            onClick={() => jumpToLocation(item.x, item.y, item.z)}
                            className="text-left font-bold text-[11px] text-[var(--ui-bright)] hover:text-[#00ffff] truncate"
                          >
                            <span style={{ color: item.color }}>{item.char}</span>{' '}
                            {item.fn.title} (Z-{item.z})
                          </button>
                          <span className="text-[9px] text-[var(--ui-warning)] shrink-0">
                            {formatCost(item.fn.cost)}
                          </span>
                        </div>
                        <div className="text-[10px] text-[var(--ui-muted)] leading-snug">
                          {item.fn.passiveFunction}
                        </div>
                        <button
                          type="button"
                          data-testid={`activate-tile-${item.terrain}`}
                          disabled={!item.fn.canActivate}
                          onClick={() => {
                            playTactileSfx('stamp');
                            const res = activateBuildingFunction(item.x, item.y, item.z);
                            setBuildingActionStatus(res.message);
                          }}
                          className="w-full py-1 px-2 border border-[#33ff00] bg-[#091c09] text-[#33ff00] hover:bg-[#123212] disabled:opacity-40 disabled:border-[var(--ui-border)] disabled:text-[var(--ui-muted)] font-bold text-[10px] text-center"
                        >
                          [ {item.fn.actionLabel}{item.fn.readyInTicks > 0 ? ` · ready in ${item.fn.readyInTicks}t` : ''} ]
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Active Workshop Work Orders with AUTO-REPEAT Toggles */}
            <div className="bg-[var(--ui-bg)] border border-[var(--ui-border)] p-2.5">
              <div className="text-[var(--ui-info)] font-bold border-b border-[var(--ui-border)] pb-1 mb-2">
                WORKSHOP PRODUCTION QUEUE
              </div>
              <div className="space-y-1.5 mb-3">
                {gameState.workOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between gap-1 bg-[var(--ui-panel)] p-1.5 border border-[var(--ui-border)]"
                  >
                    <div className="min-w-0">
                      <div className="text-[var(--ui-bright)] truncate text-[11px]">{order.title}</div>
                      <div className="text-[10px] text-[var(--ui-muted)] tabular-nums">
                        Left: <strong className="text-[var(--ui-accent)]">{order.remaining}x</strong> ·{' '}
                        {order.workshop.replace('WORKSHOP_', '')}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleWorkOrderAutoRepeat(order.id)}
                        className={`px-1 py-0.5 text-[10px] border whitespace-nowrap shrink-0 ${
                          order.autoRepeat
                            ? 'border-[var(--ui-success)] text-[var(--ui-success)] bg-[var(--ui-bg)] font-bold'
                            : 'border-[var(--ui-border)] text-[var(--ui-muted)] hover:text-[var(--ui-bright)]'
                        }`}
                      >
                        [{order.autoRepeat ? 'AUTO:ON' : 'AUTO:OFF'}]
                      </button>
                      <button
                        type="button"
                        onClick={() => removeWorkOrder(order.id)}
                        className="px-1 py-0.5 text-[10px] border border-[var(--ui-border)] text-[var(--ui-danger)] hover:bg-[var(--ui-border)] whitespace-nowrap shrink-0"
                      >
                        [X]
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-[11px] text-[var(--ui-muted)] mb-1.5">QUEUE NEW WORKSHOP ORDERS:</div>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() =>
                    addWorkOrder({
                      title: 'Smelt Steel Bars',
                      workshop: 'WORKSHOP_SMELTER',
                      cost: { ironOre: 2, wood: 1 },
                      produce: { steelBars: 2, wealth: 35 },
                      remaining: 3,
                      autoRepeat: true,
                    })
                  }
                  className="w-full py-1 px-2 border border-[var(--ui-border)] bg-[var(--ui-panel)] text-[var(--ui-warning)] hover:bg-[var(--ui-border)] text-left whitespace-nowrap shrink-0"
                >
                  Smelt steel
                </button>
                <button
                  type="button"
                  onClick={() =>
                    addWorkOrder({
                      title: 'Forge Runed Battle Axes',
                      workshop: 'WORKSHOP_FORGE',
                      cost: { steelBars: 1 },
                      produce: { weapons: 1, wealth: 55 },
                      remaining: 2,
                      autoRepeat: true,
                    })
                  }
                  className="w-full py-1 px-2 border border-[var(--ui-border)] bg-[var(--ui-panel)] text-[var(--ui-info)] hover:bg-[var(--ui-border)] text-left whitespace-nowrap shrink-0"
                >
                  Forge axes
                </button>
                <button
                  type="button"
                  onClick={() =>
                    addWorkOrder({
                      title: 'Forge Steel Plate Mail',
                      workshop: 'WORKSHOP_FORGE',
                      cost: { steelBars: 1 },
                      produce: { armor: 1, wealth: 60 },
                      remaining: 2,
                      autoRepeat: false,
                    })
                  }
                  className="w-full py-1 px-2 border border-[var(--ui-border)] bg-[var(--ui-panel)] text-[var(--ui-success)] hover:bg-[var(--ui-border)] text-left whitespace-nowrap shrink-0"
                >
                  Forge armor
                </button>
                <button
                  type="button"
                  onClick={() =>
                    addWorkOrder({
                      title: 'Brew Plump Helmet Ale',
                      workshop: 'WORKSHOP_STILL',
                      cost: { food: 2 },
                      produce: { ale: 5, wealth: 15 },
                      remaining: 3,
                      autoRepeat: true,
                    })
                  }
                  className="w-full py-1 px-2 border border-[var(--ui-border)] bg-[var(--ui-panel)] text-[var(--ui-violet)] hover:bg-[var(--ui-border)] text-left whitespace-nowrap shrink-0"
                >
                  Brew ale
                </button>
                <button
                  type="button"
                  onClick={() =>
                    addWorkOrder({
                      title: 'Carve Stone Thrones',
                      workshop: 'WORKSHOP_MASON',
                      cost: { stone: 3 },
                      produce: { furniture: 1, wealth: 25 },
                      remaining: 3,
                      autoRepeat: false,
                    })
                  }
                  className="w-full py-1 px-2 border border-[var(--ui-border)] bg-[var(--ui-panel)] text-[var(--ui-text)] hover:bg-[var(--ui-border)] text-left whitespace-nowrap shrink-0"
                >
                  Carve furniture
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'RADAR' && (
          <div className="space-y-3">
            {/* Live Spatial Mini-Map Radar */}
            <div className="bg-[var(--ui-bg)] border border-[var(--ui-border)] p-2">
              <div className="flex items-center justify-between text-[11px] border-b border-[var(--ui-border)] pb-1 mb-2">
                <span className="text-[var(--ui-success)] font-bold">SPATIAL RADAR {'//'} Z-{currentZ}</span>
                <span className="text-[var(--ui-muted)] text-[10px]">CLICK TO PING</span>
              </div>
              <div className="flex justify-center bg-[#050505] p-1 border border-[var(--ui-border)]">
                <canvas
                  ref={radarCanvasRef}
                  width={gameState.world.width * 4}
                  height={gameState.world.height * 4}
                  onClick={handleRadarClick}
                  className="w-full h-auto cursor-pointer border border-[var(--ui-border)]"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-1 mt-1.5 text-[10px] text-[var(--ui-muted)]">
                <span className="text-[var(--ui-success)]">■ Dwarf</span>
                <span className="text-[var(--ui-danger)]">■ Hostile</span>
                <span className="text-[var(--ui-info)]">■ Relic</span>
                <span className="text-[var(--ui-warning)]">■ Ore Vein</span>
              </div>
            </div>

            {/* 6-Strata Mineral, Relic & Threat Scanner */}
            <div className="bg-[var(--ui-bg)] border border-[var(--ui-border)] p-2">
              <div className="text-[var(--ui-info)] font-bold border-b border-[var(--ui-border)] pb-1 mb-2">
                DEEP STRATA ORE &amp; RELIC SCANNER
              </div>
              <div className="space-y-1.5">
                {strataSummaries.map((row) => {
                  const isCurrent = row.zLevel === currentZ;
                  const stratumMeta = gameState.world.strata[row.zLevel];
                  return (
                    <div
                      key={row.zLevel}
                      onClick={() => {
                        playTactileSfx('zlevel');
                        setCurrentZ(row.zLevel);
                      }}
                      className={`p-1.5 border cursor-pointer transition-colors ${
                        isCurrent
                          ? 'bg-[var(--ui-border)] border-[var(--ui-info)]'
                          : 'bg-[var(--ui-panel)] border-[var(--ui-border)] hover:border-[var(--ui-muted)]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 text-[11px]">
                        <span className="font-bold text-[var(--ui-bright)] truncate">
                          [Z-{row.zLevel}] {row.name}
                        </span>
                      </div>
                      {stratumMeta && (
                        <div className="text-[10px] text-[var(--ui-muted)] truncate mt-0.5">
                          {stratumMeta.primaryRock} · {stratumMeta.hazard}
                        </div>
                      )}
                      {(row.relicTiles > 0 || row.hostiles > 0) && (
                        <div className="flex flex-wrap items-center justify-between gap-1 mt-1">
                          {row.hostiles > 0 ? (
                            <span className="text-[var(--ui-danger)] font-bold text-[10px] whitespace-nowrap">
                              [! {row.hostiles} HOSTILE]
                            </span>
                          ) : (
                            <span />
                          )}
                          {row.relicTiles > 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                playTactileSfx('zlevel');
                                const relicTile = gameState.grid[row.zLevel]
                                  ?.flat()
                                  .find((t) => t.terrain === 'CAVERN_RELIC');
                                if (relicTile) {
                                  jumpToLocation(relicTile.x, relicTile.y, row.zLevel);
                                } else {
                                  setCurrentZ(row.zLevel);
                                }
                              }}
                              className="px-1.5 py-0.5 border border-[var(--ui-success)] text-[var(--ui-success)] text-[10px] font-bold hover:bg-[var(--ui-bg)]"
                            >
                              [☼ PING RELIC]
                            </button>
                          )}
                        </div>
                      )}
                      <div className="grid grid-cols-4 gap-1 mt-1 text-[10px] tabular-nums text-[var(--ui-muted)]">
                        <div>
                          IRN:<span className="text-[var(--ui-warning)] font-bold ml-0.5">{row.ironTiles}</span>
                        </div>
                        <div>
                          GLD:<span className="text-[var(--ui-accent)] font-bold ml-0.5">{row.goldTiles}</span>
                        </div>
                        <div>
                          MTH:<span className="text-[var(--ui-info)] font-bold ml-0.5">{row.mithrilTiles}</span>
                        </div>
                        <div>
                          RLC:<span className="text-[var(--ui-success)] font-bold ml-0.5">{row.relicTiles}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
