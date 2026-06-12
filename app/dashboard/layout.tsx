import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Control Center',
  description: 'Shared dashboard to access mobile upload stations and desktop labeling queues.',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
