'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { usePauseWhileOpen } from '@/hooks/use-pause-while-open';
import type { SpriteName } from '@/lib/pixel/sprites';
import { PixelIcon } from './PixelIcon';

/** True while a modal dialog is open; global shortcuts stand down. */
export function isModalOpen(): boolean {
  try {
    return Boolean(document.querySelector('dialog:modal'));
  } catch {
    return Boolean(document.querySelector('dialog[open]'));
  }
}

const supportsClosedBy = typeof HTMLDialogElement !== 'undefined' && 'closedBy' in HTMLDialogElement.prototype;

/** True when a pointer event lands outside the dialog box, i.e. on its backdrop. */
function outside(e: React.PointerEvent<HTMLDialogElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
}

/**
 * A native modal dialog: the browser supplies the focus trap, Escape to close,
 * an inert page behind it, and the top layer. Decision dialogs pause the clock.
 */
export function PixelDialog({ open, onClose, title, subtitle, icon, children, footer, width, pause = true }: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  icon?: SpriteName;
  children: ReactNode;
  footer?: ReactNode;
  /** Maximum width in CSS pixels. */
  width?: number;
  pause?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const pressedOutside = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  usePauseWhileOpen(open && pause);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleClose = () => onCloseRef.current();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, []);

  return (
    <dialog
      ref={ref}
      className="px-dialog px-panel"
      aria-labelledby={titleId}
      {...{ closedby: 'any' }}
      style={width ? ({ '--dialog-width': `${width}px` } as React.CSSProperties) : undefined}
      // Light dismiss where closedby is unsupported. Both the press and the
      // release must land on the backdrop, so a text selection dragged out of
      // the dialog does not close it.
      onPointerDown={(e) => { pressedOutside.current = !supportsClosedBy && outside(e); }}
      onPointerUp={(e) => { if (pressedOutside.current && outside(e)) ref.current?.close(); }}
    >
      <header className="dialog-head">
        {icon && <PixelIcon name={icon} scale={2} />}
        <div className="min-w-0 flex-1">
          <h2 id={titleId}>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button type="button" className="px-btn px-btn--icon px-btn--ghost" aria-label={`Close ${title}`} onClick={() => ref.current?.close()}>
          <PixelIcon name="icon_close" />
        </button>
      </header>
      <div className="dialog-body px-scroll">{open && children}</div>
      {footer && open && <footer className="dialog-foot">{footer}</footer>}
    </dialog>
  );
}
