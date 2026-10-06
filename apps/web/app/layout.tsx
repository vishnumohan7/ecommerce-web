import './theme.css';
import { SiteHeader } from '../components/site-header';
import { CookieBanner } from '../components/cookie-banner';

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-GB"><body><SiteHeader />{children}<footer><strong>Denes Market</strong><nav><a href="/legal/terms">Terms</a><a href="/legal/privacy">Privacy</a><a href="/legal/cookies">Cookies</a><a href="/help/contact">Help</a></nav><small>Alcohol is only available to customers aged 18 or over. Challenge 25 applies on delivery.</small></footer><CookieBanner /></body></html>;
}
export const metadata = { title: { default: 'Denes Market', template: '%s — Denes Market' }, description: 'Groceries and drinks delivered locally.' };
