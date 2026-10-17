import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { NavProgress } from '@/components/nav/NavProgress';
import { NavTiming } from '@/components/nav/NavTiming';
import './globals.css';

export const metadata: Metadata = {
  title: 'ExhibitAR',
  description: 'Turn any 3D-printed object into an AR exhibit.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en">
      <body>
        <NavProgress />
        {children}
        <Analytics />
        <SpeedInsights />
        <NavTiming />
      </body>
    </html>
  );
}
