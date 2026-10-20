import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ASCII Fortress — Dwarven Colony & Procedural World Simulation',
  description:
    'A modern, intuitive Dwarf Fortress-style simulation with multi-Z-level ASCII graphics, procedural world history, and a voice-enabled AI Royal Advisor.',
  openGraph: {
    title: 'ASCII Fortress — Dwarven Colony & Procedural World Simulation',
    description:
      'A modern, intuitive Dwarf Fortress-style simulation with multi-Z-level ASCII graphics, procedural world history, and a voice-enabled AI Royal Advisor.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ASCII Fortress — Dwarven Colony & Procedural World Simulation',
    description:
      'A modern, intuitive Dwarf Fortress-style simulation with multi-Z-level ASCII graphics, procedural world history, and a voice-enabled AI Royal Advisor.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#070b12] text-slate-100 antialiased selection:bg-[#ff0099]/30 selection:text-[#ff0099]" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
