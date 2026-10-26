import type { Metadata } from 'next';
import { PrivacyPolicy } from '@/components/legal/PrivacyPolicy';

export const metadata: Metadata = {
  title: 'Privacy policy · ExhibitAR',
  description:
    'What ExhibitAR collects, why, where it is kept and how to have it removed. Your STL file never leaves your computer, and visitors need no account.',
};

export default function PrivacyPage() {
  return <PrivacyPolicy />;
}
