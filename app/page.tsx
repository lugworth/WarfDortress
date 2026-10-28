'use client';

import { useEffect, useState } from 'react';
import { GameProvider, useGame } from '@/components/GameProvider';
import { UIProvider, useUI } from '@/components/UIProvider';
import TitleScreen from '@/components/TitleScreen';
import PixelMap from '@/components/map/PixelMap';
import { isModalOpen } from '@/components/pixel/PixelDialog';
import { PixelIcon } from '@/components/pixel/PixelIcon';
import TopBar from '@/components/shell/TopBar';
import NavRail, { LEFT_PANELS, type DialogId, type LeftPanel, type RightPanel } from '@/components/shell/NavRail';
import Drawer from '@/components/shell/Drawer';
import Toasts from '@/components/shell/Toasts';
import ClanPanel from '@/components/panels/ClanPanel';
import QuestsPanel from '@/components/panels/QuestsPanel';
import StocksPanel from '@/components/panels/StocksPanel';
import RadarPanel from '@/components/panels/RadarPanel';
import ChroniclePanel from '@/components/panels/ChroniclePanel';
import TutorialPanel from '@/components/panels/TutorialPanel';
import DecreeDialog from '@/components/dialogs/DecreeDialog';
import TradeDialog from '@/components/dialogs/TradeDialog';
import GuildDialog from '@/components/dialogs/GuildDialog';
import CommandDialog from '@/components/dialogs/CommandDialog';
import SettingsDialog from '@/components/dialogs/SettingsDialog';
import type { TutorialAction } from '@/lib/tutorial';

const narrow = () => window.matchMedia('(max-width: 1023px)').matches;

function Fortress() {
  const {
    screen,
    gameState,
    progression,
    setGameState,
    setSelectedTool,
    setInspectMode,
    handleCloudSave,
    embarkNewWorld,
    triggerNarrativeEvent,
  } = useGame();
  const { openOverlay } = useUI();
  const [left, setLeft] = useState<LeftPanel | null>(null);
  const [right, setRight] = useState<RightPanel | null>(null);
  const [dialog, setDialog] = useState<DialogId | null>(null);
  const [guideStep, setGuideStep] = useState(0);

  // Side panels cover the map on small screens, so only one is open there.
  const toggleLeft = (panel: LeftPanel) => {
    setLeft((current) => (current === panel ? null : panel));
    if (narrow()) setRight(null);
  };
  const toggleRight = (panel: RightPanel) => {
    if (panel === 'guide' && right !== 'guide') setGameState((s) => ({ ...s, paused: true }));
    setRight((current) => (current === panel ? null : panel));
    if (narrow()) setLeft(null);
  };
  const showMap = () => {
    if (narrow()) {
      setLeft(null);
      setRight(null);
    }
  };
  const openDialog = (id: DialogId) => {
    if (id === 'decree' && !gameState.activeEvent) triggerNarrativeEvent(undefined, true);
    setDialog(id);
  };
  const openGoals = () => {
    setLeft('quests');
    if (narrow()) setRight(null);
  };
  const openGuide = () => {
    setGameState((s) => ({ ...s, paused: true }));
    setRight('guide');
    if (narrow()) setLeft(null);
  };
  const guideAction = (action: TutorialAction) => {
    switch (action) {
      case 'GOALS': openGoals(); return;
      case 'DISPLAY': openOverlay('settings'); return;
      case 'TRADE': setDialog('trade'); return;
      case 'GUILD': setDialog('guild'); return;
      case 'DECREES': openDialog('decree'); return;
      case 'SAVE': handleCloudSave(); return;
      case 'CHRONICLE': setRight('chronicle'); return;
      case 'CLAN': setLeft('clan'); if (narrow()) setRight(null); return;
      default:
        setSelectedTool(action === 'MINE' ? 'MINE' : action === 'STAIRS' ? 'STAIRS' : 'BUILD_FARM');
        setInspectMode(false);
        setLeft(null);
        if (narrow()) setRight(null);
    }
  };

  const embark = async (seed: string) => {
    setGuideStep(0);
    setLeft(null);
    setRight('guide');
    await embarkNewWorld(seed, true);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (screen !== 'playing' || e.key !== '/' || e.repeat || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (target.closest('input, textarea, select, [contenteditable="true"]') || isModalOpen()) return;
      e.preventDefault();
      openOverlay('commands');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, openOverlay]);

  if (screen === 'title') return <TitleScreen onEmbark={embark} />;

  const claimable = progression.milestones.filter((m) => m.completed && !m.claimed).length + (progression.canFulfillMood ? 1 : 0);
  const commission = gameState.guild.commissions.find((c) => c.status === 'ACTIVE');
  const commissionReady = Boolean(commission && gameState.resources[commission.requirement.resource] >= commission.requirement.amount);
  const event = gameState.activeEvent;

  return (
    <div className="game">
      <TopBar onGoals={openGoals} onGuide={openGuide} />
      <div className="workspace">
        <NavRail
          left={left}
          right={right}
          badges={{ quests: claimable, decree: Boolean(event), radar: gameState.hostiles.length, guild: commissionReady }}
          onLeft={toggleLeft}
          onRight={toggleRight}
          onDialog={openDialog}
        />
        {left && (
          <Drawer id="left-drawer" title={LEFT_PANELS[left].title} icon={LEFT_PANELS[left].icon} onClose={() => setLeft(null)}>
            {left === 'clan' && <ClanPanel />}
            {left === 'quests' && <QuestsPanel />}
            {left === 'stocks' && <StocksPanel />}
            {left === 'radar' && <RadarPanel />}
          </Drawer>
        )}
        <main className="stage" aria-label="Fortress map">
          <PixelMap />
          {event && (
            <button type="button" className="event-banner" data-danger={event.severity === 'MAJOR_CRISIS' || undefined} onClick={() => setDialog('decree')}>
              <PixelIcon name={event.severity === 'MAJOR_CRISIS' ? 'icon_warning' : 'icon_decree'} />
              <strong>Decree needed</strong>
              <span>{event.title}</span>
            </button>
          )}
        </main>
        {right && (
          <Drawer id="right-drawer" side="right" title={right === 'guide' ? 'New colony guide' : 'Chronicle'} icon={right === 'guide' ? 'icon_book' : 'icon_chronicle'}
            onClose={() => setRight(null)} scroll={false}>
            {right === 'guide'
              ? <TutorialPanel step={guideStep} onStep={setGuideStep} onAction={guideAction}
                onFinish={() => { setRight(null); setGameState((s) => ({ ...s, paused: false })); }} />
              : <ChroniclePanel />}
          </Drawer>
        )}
      </div>
      <Toasts />
      <DecreeDialog open={dialog === 'decree'} onClose={() => setDialog(null)} />
      <TradeDialog open={dialog === 'trade'} onClose={() => setDialog(null)} />
      <GuildDialog open={dialog === 'guild'} onClose={() => setDialog(null)} />
      <CommandDialog onChosen={showMap} />
      <SettingsDialog />
    </div>
  );
}

export default function Home() {
  return (
    <GameProvider>
      <UIProvider>
        <Fortress />
      </UIProvider>
    </GameProvider>
  );
}
