/* eslint-disable local/no-jsx-literals -- Milestone 17 preview copy is English-only until the localisation catalogue lands. */
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Feature status' };

const features = [
  {
    name: 'Admin shell and navigation',
    area: 'Foundation',
    status: 'Live',
    detail: 'Responsive operations layout with secure staff session support.',
  },
  {
    name: 'Catalogue list and search',
    area: 'Products',
    status: 'Live',
    detail: 'Full product/category/brand CRUD connected to live APIs.',
  },
  {
    name: 'Service health',
    area: 'Operations',
    status: 'Live',
    detail: 'Liveness and dependency readiness endpoints.',
  },
  {
    name: 'Product create and edit',
    area: 'Products',
    status: 'Live',
    detail: 'Create, full edit and confirmed archive controls are enabled.',
  },
  {
    name: 'Inventory adjustment',
    area: 'Inventory',
    status: 'Live',
    detail: 'Stock list and audited receipt, wastage, return and adjustment actions.',
  },
  {
    name: 'Promotions management',
    area: 'Merchandising',
    status: 'Live',
    detail: 'HFSS-aware promotion schedules and activation are connected.',
  },
  {
    name: 'Orders and refunds',
    area: 'Fulfilment',
    status: 'Live',
    detail: 'Combined order detail, fulfilment, invoices, returns and refunds.',
  },
  {
    name: 'Customer management',
    area: 'CRM',
    status: 'Live',
    detail: 'Customer search, spend/order visibility and account controls.',
  },
  {
    name: 'Roles, permissions and audit',
    area: 'Security',
    status: 'Live',
    detail: 'Role mappings, settings, audit, reports, privacy and licence screens.',
  },
] as const;

export default function FeatureStatusPage() {
  return (
    <>
      <section className="page-heading compact-heading">
        <div>
          <p className="eyebrow">Admin capability matrix</p>
          <h1>Admin feature status</h1>
          <p>Live modules and their operational scope.</p>
        </div>
      </section>
      <article className="panel feature-panel">
        <div className="feature-legend">
          <span className="legend-live">
            <i />
            Available now
          </span>
        </div>
        <div className="feature-list">
          {features.map((feature) => {
            return (
              <section key={feature.name}>
                <span className="feature-state live">
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
