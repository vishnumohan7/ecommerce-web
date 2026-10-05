import './theme.css';
const messages = { title: 'Storefront' };
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en-GB"><body>{children}</body></html>; }
export const metadata = { title: messages.title };
