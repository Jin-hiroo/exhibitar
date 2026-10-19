import type { Metadata } from 'next';
import { Landing } from '@/components/landing/Landing';

export const metadata: Metadata = {
  title: 'ExhibitAR: turn any 3D print into an AR exhibit',
  description:
    'Upload an STL, mark what matters and print one placement mat. Visitors scan its QR code and see labels on the real object, with no app to install. Free and open source.',
};

export default function Home() {
  return <Landing />;
}
