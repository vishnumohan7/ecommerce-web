/* eslint-disable local/no-jsx-literals -- Operations copy is English-only. */
import Link from 'next/link';
import { createStaffUser, sendStaffPasswordReset, updateStaffUser } from '../actions';
import { ActionMessage } from '../components/action-message';
import { ApiNotice } from '../components/api-notice';
import { TablePagination } from '../components/table-pagination';
import { fetchStaff } from '../lib/api';

export const dynamic = 'force-dynamic';

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; success?: string; error?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? '';
  const result = await fetchStaff({ q, page: Math.max(1, Number(params.page) || 1) });
  const roles = result.ok ? result.data.roles : [];
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Administration</p>
          <h1>User management</h1>
          <p>Create staff accounts, control access and send secure password setup links.</p>
        </div>
        <span className="count-pill">{result.ok ? result.data.total : 0} staff</span>
      </section>
      <ActionMessage success={params.success} error={params.error} />
      {!result.ok ? (
        <ApiNotice message={result.error} />
      ) : (
        <>
          <article className="panel staff-create-panel">
            <header className="panel-header">
              <div>
                <p className="eyebrow">New staff account</p>
                <h2>Invite a user</h2>
                <p>The user receives a secure email link to choose their password.</p>
              </div>
            </header>
            <form action={createStaffUser} className="staff-create-form">
              <label className="form-field">
                First name
                <input name="firstName" required maxLength={100} autoComplete="given-name" />
              </label>
              <label className="form-field">
                Last name
                <input name="lastName" required maxLength={100} autoComplete="family-name" />
              </label>
              <label className="form-field staff-email-field">
                Email address
                <input name="email" type="email" required maxLength={255} autoComplete="email" />
              </label>
              <fieldset className="staff-role-field">
                <legend>Roles</legend>
                <div className="role-chip-list">
                  {roles.map((role) => (
                    <label key={role.id} title={role.description}>
                      <input
                        type="checkbox"
                        name="roleKeys"
                        value={role.key}
                        defaultChecked={role.key === 'STORE_MANAGER'}
                      />
                      <span>{role.name}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <button className="button button-primary" type="submit">
                Send invitation
              </button>
            </form>
          </article>

          <article className="panel section-gap">
            <header className="panel-header staff-list-header">
              <div>
                <p className="eyebrow">Authorised access</p>
                <h2>Staff accounts</h2>
                <p>Disabled users are signed out and cannot access the admin panel.</p>
              </div>
              <form action="/users" className="staff-search" role="search">
                <input
                  name="q"
                  defaultValue={q}
                  placeholder="Search name or email"
                  aria-label="Search staff"
                />
                <button className="button button-muted">Search</button>
                {q && (
                  <Link href="/users" className="clear-link">
                    Clear
                  </Link>
                )}
              </form>
            </header>
            {result.data.items.length === 0 ? (
              <div className="empty-state">
                <h3>No staff users found</h3>
                <p>Invite the first staff user or change your search.</p>
              </div>
            ) : (
              <div className="staff-management-list">
                {result.data.items.map((user) => (
                  <section className="staff-account" key={user.id}>
                    <form action={updateStaffUser} className="staff-account-form">
                      <input type="hidden" name="id" value={user.id} />
                      <div className="staff-identity">
                        <span className="staff-avatar">
                          {user.firstName.charAt(0)}
                          {user.lastName.charAt(0)}
                        </span>
                        <div>
                          <strong>
                            {user.firstName} {user.lastName}
                          </strong>
                          <small>{user.email}</small>
                          <small>
                            Added {new Date(user.createdAt).toLocaleDateString('en-GB')}
                          </small>
                        </div>
                      </div>
                      <label className="form-field">
                        <span>First name</span>
                        <input
                          name="firstName"
                          defaultValue={user.firstName}
                          required
                          maxLength={100}
                        />
                      </label>
                      <label className="form-field">
                        <span>Last name</span>
                        <input
                          name="lastName"
                          defaultValue={user.lastName}
                          required
                          maxLength={100}
                        />
                      </label>
                      <fieldset className="staff-role-field">
                        <legend>Assigned roles</legend>
                        <div className="role-chip-list">
                          {roles.map((role) => (
                            <label key={role.id} title={role.description}>
                              <input
                                type="checkbox"
                                name="roleKeys"
                                value={role.key}
                                defaultChecked={user.roleKeys.includes(role.key)}
                              />
                              <span>{role.name}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      <label className="staff-active-toggle">
                        <input type="checkbox" name="active" defaultChecked={user.active} />
                        <span aria-hidden="true" />
                        <strong>{user.active ? 'Active' : 'Disabled'}</strong>
                      </label>
                      <button className="button button-primary" type="submit">
                        Save changes
                      </button>
                    </form>
                    <form action={sendStaffPasswordReset} className="staff-reset-form">
                      <input type="hidden" name="id" value={user.id} />
                      <button className="text-action" type="submit">
                        Send password reset
                      </button>
                    </form>
                  </section>
                ))}
              </div>
            )}
            <TablePagination
              basePath="/users"
              page={result.data.page}
              pageCount={result.data.pageCount}
              total={result.data.total}
              params={q ? { q } : {}}
            />
          </article>
        </>
      )}
    </>
  );
}
