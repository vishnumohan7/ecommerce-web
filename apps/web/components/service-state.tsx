import Link from 'next/link';

export function ServiceState({ title, description, actionHref = '/', action = 'Return home' }: Readonly<{ title: string; description: string; actionHref?: string; action?: string }>) {
  return <section className="empty-state"><p className="eyebrow">Service status</p><h1>{title}</h1><p>{description}</p><Link className="button" href={actionHref}>{action}</Link></section>;
}
