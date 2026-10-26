import type { Metadata } from 'next';
import { TermsOfService } from '@/components/legal/TermsOfService';

export const metadata: Metadata = {
  title: 'Terms of service · ExhibitAR',
  description:
    'The rules for using ExhibitAR at exhibitar.vercel.app: your content stays yours, published exhibits are public, and the laws of Japan apply.',
};

export default function TermsPage() {
  return <TermsOfService />;
}
