import type {Metadata} from 'next';
import { Outfit } from 'next/font/google';
import { AuthProvider } from '@/hooks/use-auth';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-outfit',
});

export const metadata: Metadata = {
  title: {
    default: 'Fabric Inventory Catalog',
    template: '%s | Fabric Inventory Catalog',
  },
  description: 'Professional fabric inventory digitization and physical sample tracking system. Connect mobile upload stations and labeling desks to archive inventory using barcode stickers.',
  keywords: ['fabric inventory', 'fabric digitization', 'barcode labels', 'textile management', 'inventory tracking'],
  authors: [{ name: 'Ziegler Code' }],
  creator: 'Ziegler Code',
  robots: {
    index: false, // Set to false to avoid search engines indexing internal workspaces, or true if public
    follow: true,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    title: 'Fabric Inventory Catalog',
    description: 'Professional fabric inventory digitization and physical sample tracking system.',
    siteName: 'Fabric Inventory Catalog',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Fabric Inventory Catalog',
    description: 'Professional fabric inventory digitization and physical sample tracking system.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${outfit.variable} font-sans`}>
      <body suppressHydrationWarning className="bg-[#F8FAFC]">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
