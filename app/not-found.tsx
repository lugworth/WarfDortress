import Link from 'next/link';
import { PixelSprite } from '@/components/pixel/PixelIcon';

export default function NotFound() {
  return (
    <main className="app title-screen">
      <section className="px-panel title-card" style={{ maxWidth: 440, margin: '0 auto', textAlign: 'center', justifyItems: 'center' }}>
        <PixelSprite name="dwarf_sleep" scale={4} />
        <h1 className="px-title">404 · Uncharted cavern</h1>
        <p style={{ margin: 0 }}>The miners struck deep, but found only empty air. No such chamber exists in the royal archives.</p>
        <Link href="/" className="px-btn px-btn--gold">Return to the gate</Link>
      </section>
    </main>
  );
}
