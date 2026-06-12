import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Portal Login',
  description: 'Sign in to access the shared fabric inventory catalog and digitization workspace.',
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
