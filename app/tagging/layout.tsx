import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Labeling & Printing Desk',
  description: 'Desktop workspace for reviewing incoming fabric photos, assigning names, and printing barcode labels.',
};

export default function TaggingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
