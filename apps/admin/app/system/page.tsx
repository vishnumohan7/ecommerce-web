/* eslint-disable local/no-jsx-literals -- Operations copy is English-only. */
import type { Metadata } from 'next';
import { ApiNotice } from '../components/api-notice';
import { API_BASE_URL, fetchHealth } from '../lib/api';

export const metadata: Metadata = { title: 'System health' };
export const dynamic = 'force-dynamic';

export default async function SystemPage() {
  const [liveness, readiness] = await Promise.all([fetchHealth('health'), fetchHealth('ready')]);
  return (
    <>
      <section className="page-heading compact-heading">
        <div>
          <p className="eyebrow">Platform</p>
          <h1>System health</h1>
          <p>Direct status from the API service and its configured dependencies.</p>
        </div>
      </section>
      {!liveness.ok && <ApiNotice message={liveness.error} />}
      <section className="health-grid">
        <article className="panel health-card">
          <header>
            <span className={`health-icon ${liveness.ok ? 'up' : 'down'}`}>API</span>
            <span className={`status-badge ${liveness.ok ? 'status-active' : 'status-down'}`}>
              <span />
              {liveness.ok ? liveness.data.status : 'offline'}
            </span>
          </header>
          <h2>Liveness</h2>
          <p>Confirms that the NestJS service can accept requests.</p>
          <code>{API_BASE_URL}/health</code>
        </article>
        <article className="panel health-card">
          <header>
            <span className={`health-icon ${readiness.ok ? 'up' : 'warn'}`}>DEP</span>
            <span className={`status-badge ${readiness.ok ? 'status-active' : 'status-warn'}`}>
              <span />
              {readiness.ok ? readiness.data.status : 'unavailable'}
            </span>
          </header>
          <h2>Dependency readiness</h2>
          <p>Checks the API dependencies currently configured for the environment.</p>
          <code>{API_BASE_URL}/ready</code>
          {readiness.ok && readiness.data.checks && (
            <ul className="check-list">
              {readiness.data.checks.map((check) => (
                <li key={check}>✓ {check}</li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </>
  );
}
