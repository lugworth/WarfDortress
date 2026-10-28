import type { ReactNode } from 'react';
import { PixelIcon } from '@/components/pixel/PixelIcon';
import type { SpriteName } from '@/lib/pixel/sprites';

/** A side panel beside the map. */
export default function Drawer({ id, title, icon, side = 'left', onClose, children, scroll = true }: {
  id: string;
  title: string;
  icon: SpriteName;
  side?: 'left' | 'right';
  onClose: () => void;
  children: ReactNode;
  scroll?: boolean;
}) {
  return (
    <aside id={id} className={`drawer ${side === 'right' ? 'drawer--right' : ''}`} aria-label={title}>
      <div className="drawer-head">
        <PixelIcon name={icon} />
        <h2>{title}</h2>
        <button type="button" className="px-btn px-btn--icon px-btn--ghost px-btn--small" aria-label={`Close ${title}`} onClick={onClose}>
          <PixelIcon name="icon_close" />
        </button>
      </div>
      {scroll ? <div className="drawer-body px-scroll">{children}</div> : children}
    </aside>
  );
}
