import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';

// Both fonts are bundled (SIL Open Font License) so builds need no network.
const pixel = localFont({
  src: './fonts/PixelifySans-Latin.woff2',
  weight: '400 700',
  variable: '--font-pixel',
  display: 'swap',
});
const display = localFont({
  src: './fonts/PressStart2P-Latin.woff2',
  weight: '400',
  variable: '--font-display-pixel',
  display: 'swap',
});

const title = 'Deep Anvil — a pixel-art dwarf fortress colony sim';
const description =
  'Lead seven dwarven pioneers from a hillside camp to a Mountainhome capital: dig through six layers of rock, run workshops, raise a militia, and trade with caravans in an animated pixel-art world.';

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, type: 'website' },
  twitter: { card: 'summary_large_image', title, description },
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Deep Anvil' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0d0a12',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${pixel.variable} ${display.variable}`}>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
