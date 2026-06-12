import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Fabric Selection',
  description: 'Scan and save fabric samples while browsing the showroom.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return children;
}
