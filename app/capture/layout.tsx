import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Camera Upload Desk',
  description: 'Mobile capture station for photographers to upload physical fabric samples to the labeling queue.',
};

export default function CaptureLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
