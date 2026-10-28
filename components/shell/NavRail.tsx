'use client';

import { PixelIcon } from '@/components/pixel/PixelIcon';
import type { SpriteName } from '@/lib/pixel/sprites';

export type LeftPanel = 'clan' | 'quests' | 'stocks' | 'radar';
export type RightPanel = 'chronicle' | 'guide';
export type DialogId = 'guild' | 'trade' | 'decree';

export const LEFT_PANELS: Record<LeftPanel, { label: string; title: string; icon: SpriteName }> = {
  clan: { label: 'Clan', title: 'Clan & militia', icon: 'icon_clan' },
  quests: { label: 'Quests', title: 'Goals & quests', icon: 'icon_trophy' },
  stocks: { label: 'Stocks', title: 'Stocks & industry', icon: 'icon_barrel' },
  radar: { label: 'Radar', title: 'Strata radar', icon: 'icon_radar' },
};

interface Props {
  left: LeftPanel | null;
  right: RightPanel | null;
  badges: { quests: number; decree: boolean; radar: number; guild: boolean };
  onLeft: (panel: LeftPanel) => void;
  onRight: (panel: RightPanel) => void;
  onDialog: (dialog: DialogId) => void;
}

function RailButton({ icon, label, pressed, expanded, controls, badge, onClick }: {
  icon: SpriteName;
  label: string;
  pressed?: boolean;
  expanded?: boolean;
  controls?: string;
  badge?: number | string | false;
  onClick: () => void;
}) {
  return (
    <button type="button" className="rail-btn" aria-pressed={pressed} aria-expanded={expanded} aria-controls={controls}
      aria-haspopup={expanded === undefined && pressed === undefined ? 'dialog' : undefined} onClick={onClick}>
      <PixelIcon name={icon} scale={2} />
      <span>{label}</span>
      {badge ? <span className="badge" aria-label={`${badge} new`}>{badge}</span> : null}
    </button>
  );
}

export default function NavRail({ left, right, badges, onLeft, onRight, onDialog }: Props) {
  return (
    <nav className="rail" aria-label="Fortress">
      {(Object.keys(LEFT_PANELS) as LeftPanel[]).map((id) => (
        <RailButton key={id} icon={LEFT_PANELS[id].icon} label={LEFT_PANELS[id].label} expanded={left === id} controls="left-drawer"
          badge={id === 'quests' ? badges.quests : id === 'radar' ? badges.radar : false} onClick={() => onLeft(id)} />
      ))}
      <span className="rail-sep" aria-hidden="true" />
      <RailButton icon="icon_banner" label="Guild" badge={badges.guild && '!'} onClick={() => onDialog('guild')} />
      <RailButton icon="icon_trade" label="Trade" onClick={() => onDialog('trade')} />
      <RailButton icon="icon_decree" label="Decrees" badge={badges.decree && '!'} onClick={() => onDialog('decree')} />
      <span className="rail-sep" aria-hidden="true" />
      <RailButton icon="icon_chronicle" label="Chronicle" expanded={right === 'chronicle'} controls="right-drawer" onClick={() => onRight('chronicle')} />
      <RailButton icon="icon_book" label="Guide" expanded={right === 'guide'} controls="right-drawer" onClick={() => onRight('guide')} />
    </nav>
  );
}
