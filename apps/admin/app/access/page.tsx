/* eslint-disable local/no-jsx-literals */
import { saveRolePermissions } from '../actions';
import { ActionMessage } from '../components/action-message';
import { ApiNotice } from '../components/api-notice';
import { fetchRbac } from '../lib/api';

export const dynamic = 'force-dynamic';

const permissionLabels: Record<string, string> = {
  'audit.read': 'View audit log',
  'catalog.read': 'View catalogue',
  'catalog.write': 'Manage catalogue',
  'delivery.read': 'View delivery',
  'delivery.write': 'Manage delivery',
  'inventory.read': 'View inventory',
  'inventory.write': 'Adjust inventory',
  'orders.read': 'View orders',
  'orders.write': 'Manage orders',
  'refunds.create': 'Issue refunds',
  'reports.read': 'View reports',
  'settings.read': 'View settings',
  'settings.write': 'Manage settings',
  'users.read': 'View customers',
  'users.write': 'Manage customers',
};

export default async function AccessPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const [params, result] = await Promise.all([searchParams, fetchRbac()]);
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Security</p>
          <h1>Roles & permissions</h1>
          <p>Control what each staff role can view and manage.</p>
        </div>
      </section>
      <ActionMessage success={params.success} error={params.error} />
      {!result.ok ? (
        <ApiNotice message={result.error} />
      ) : (
        <section className="roles-grid">
          {result.data.roles.map((role) => (
            <form action={saveRolePermissions} className="panel role-card" key={role.id}>
              <input type="hidden" name="id" value={role.id} />
              <header className="panel-header role-header">
                <div>
                  <h2>{role.name}</h2>
                  <small>{role.description}</small>
                </div>
                <span className="permission-count">
                  {role.permissionKeys.length} of {result.data.permissions.length}
                </span>
              </header>
              <div className="permission-grid">
                {result.data.permissions.map((permission) => (
                  <label className="permission-option" key={permission.id}>
                    <input
                      type="checkbox"
                      name="permissionKeys"
                      value={permission.key}
                      defaultChecked={role.permissionKeys.includes(permission.key)}
                    />
                    <span className="custom-check" aria-hidden="true" />
                    <span>
                      <strong>{permissionLabels[permission.key] ?? permission.key}</strong>
                      <small>{permission.key}</small>
                    </span>
                  </label>
                ))}
              </div>
              <footer className="panel-actions">
                <button className="button button-primary">Save permissions</button>
              </footer>
            </form>
          ))}
        </section>
      )}
    </>
  );
}
