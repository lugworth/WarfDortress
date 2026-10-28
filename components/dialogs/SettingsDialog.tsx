'use client';

import { useState } from 'react';
import { useUI } from '@/components/UIProvider';
import { PixelDialog } from '@/components/pixel/PixelDialog';
import { isTactileSfxMuted, setTactileSfxMuted } from '@/lib/audio';
import { FONT_SIZES, MAP_ZOOMS, type UIPreferences } from '@/lib/ui-preferences';

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="px-check setting-row">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span><strong>{label}</strong>{hint && <small className="px-muted" style={{ display: 'block' }}>{hint}</small>}</span>
    </label>
  );
}

export default function SettingsDialog() {
  const { overlay, closeOverlay, preferences, updatePreferences, storageError } = useUI();
  const [muted, setMuted] = useState(isTactileSfxMuted);
  return (
    <PixelDialog open={overlay === 'settings'} onClose={closeOverlay} title="Settings" icon="icon_gear" width={520} subtitle="Saved in this browser · Clock paused">
      <div className="px-stack">
        <label className="setting-row">
          <strong>Text size</strong>
          <select className="px-input" value={preferences.fontSize} onChange={(e) => updatePreferences({ fontSize: Number(e.target.value) })}>
            {FONT_SIZES.map((size) => <option key={size} value={size}>{size}px{size === 16 ? ' (default)' : ''}</option>)}
          </select>
        </label>
        <label className="setting-row">
          <strong>Map zoom <small className="px-muted" style={{ display: 'block', fontWeight: 400 }}>Ctrl + wheel, pinch, or + and − also zoom</small></strong>
          <select className="px-input" value={String(preferences.mapZoom)}
            onChange={(e) => updatePreferences({ mapZoom: e.target.value === 'fit' ? 'fit' : Number(e.target.value) as UIPreferences['mapZoom'] })}>
            <option value="fit">Fit the whole map</option>
            {MAP_ZOOMS.map((zoom) => <option key={zoom} value={zoom}>{zoom}%{zoom === 200 ? ' (default)' : ''}</option>)}
          </select>
        </label>
        <label className="setting-row">
          <strong>Colors</strong>
          <select className="px-input" value={preferences.theme} onChange={(e) => updatePreferences({ theme: e.target.value as UIPreferences['theme'] })}>
            <option value="pixel">Deep Anvil</option>
            <option value="contrast">High contrast</option>
          </select>
        </label>
        <hr className="px-divider" />
        <Toggle checked={preferences.labels} onChange={(labels) => updatePreferences({ labels })} label="Name labels on the map" hint="Dwarves, threats, workshops, and stairs" />
        <Toggle checked={preferences.tooltips} onChange={(tooltips) => updatePreferences({ tooltips })} label="Tile tips and tooltips" hint="Describes the tile under the pointer" />
        <Toggle checked={preferences.reducedMotion} onChange={(reducedMotion) => updatePreferences({ reducedMotion })} label="Reduce motion" hint="Stills water, weather, particles, and interface animation. Your system setting is respected too." />
        <Toggle checked={!muted} onChange={(on) => { setTactileSfxMuted(!on); setMuted(!on); }} label="Interface sounds" />
        <hr className="px-divider" />
        <p className="px-muted" style={{ margin: 0, fontSize: '0.85em' }}>
          Keys: <kbd className="px-kbd">Space</kbd> pause · <kbd className="px-kbd">/</kbd> commands · <kbd className="px-kbd">I</kbd> inspect · <kbd className="px-kbd">[</kbd> <kbd className="px-kbd">]</kbd> depth · <kbd className="px-kbd">+</kbd> <kbd className="px-kbd">−</kbd> zoom ·
          arrows move the map cursor · Shift + arrows select · Enter queues.
        </p>
        {storageError && <p role="status" className="px-ember" style={{ margin: 0 }}>{storageError}</p>}
      </div>
    </PixelDialog>
  );
}
