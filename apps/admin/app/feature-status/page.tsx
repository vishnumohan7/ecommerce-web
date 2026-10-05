/* eslint-disable local/no-jsx-literals -- Milestone 17 preview copy is English-only until the localisation catalogue lands. */
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Feature status' };

const features = [
  {
    name: 'Admin shell and navigation',
    area: 'Foundation',
    status: 'Preview ready',
    detail: 'Responsive Larkon-inspired operations layout.',
  },
  {
    name: 'Catalogue list and search',
    area: 'Products',
    status: 'Live read',
    detail: 'Connected to product and search APIs with empty/error states.',
  },
  {
    name: 'Service health',
    area: 'Operations',
    status: 'Live read',
    detail: 'Liveness and dependency readiness endpoints.',
  },
  {
    name: 'Product create and edit',
    area: 'Products',
    status: 'Backend dependency',
    detail:
      'Write API exists; admin authentication/session flow is required before enabling controls.',
  },
  {
    name: 'Inventory adjustment',
    area: 'Inventory',
    status: 'Backend dependency',
    detail: 'Reservation and adjustment APIs exist; secure admin workflow is pending.',
  },
  {
    name: 'Promotions management',
    area: 'Merchandising',
    status: 'Backend dependency',
    detail: 'Promotion create API exists; list/edit APIs and secured UI remain.',
  },
  {
    name: 'Orders and refunds',
    area: 'Fulfilment',
    status: 'Planned',
    detail: 'Enabled when order-management backend milestones land.',
  },
  {
    name: 'Customer management',
    area: 'CRM',
    status: 'Planned',
    detail: 'Enabled when admin-safe customer APIs land.',
  },
  {
    name: 'Roles, permissions and audit',
    area: 'Security',
    status: 'Planned',
    detail: 'Required for full Milestone 17 completion.',
  },
] as const;

export default function FeatureStatusPage() {
  return (
    <>
      <section className="page-heading compact-heading">
        <div>
          <p className="eyebrow">Milestone 17 preview</p>
          <h1>Admin feature status</h1>
          <p>An honest view of usable screens, API dependencies and remaining secure workflows.</p>
        </div>
      </section>
      <article className="panel feature-panel">
        <div className="feature-legend">
          <span className="legend-live">
            <i />
            Available now
          </span>
          <span className="legend-dependency">
            <i />
            Waiting on secure workflow
          </span>
          <span className="legend-planned">
            <i />
            Planned
          </span>
        </div>
        <div className="feature-list">
          {features.map((feature) => {
            const tone =
              feature.status === 'Live read' || feature.status === 'Preview ready'
                ? 'live'
                : feature.status === 'Backend dependency'
                  ? 'dependency'
                  : 'planned';
            return (
              <section key={feature.name}>
                <span className={`feature-state ${tone}`}>
                  <i />
                  {feature.status}
                </span>
                <div>
                  <p>{feature.area}</p>
                  <h2>{feature.name}</h2>
                  <span>{feature.detail}</span>
                </div>
              </section>
            );
          })}
        </div>
      </article>
    </>
  );
}
