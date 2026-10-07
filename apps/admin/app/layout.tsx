import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AdminChrome } from './components/admin-chrome';
import './theme.css';
import './orders/orders.css';

export const metadata: Metadata = {
  title: { default: 'Denes Commerce — Admin', template: '%s — Denes Admin' },
  description: 'Operations console for the Denes grocery and alcohol commerce platform.',
};

export default function Layout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en-GB"><body><AdminChrome>{children}</AdminChrome></body></html>;
}
