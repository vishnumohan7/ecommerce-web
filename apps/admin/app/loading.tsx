export default function Loading() {
  return (
    <div className="route-loading" role="status" aria-live="polite">
      <span className="route-loading-bar" />
      <section className="route-loading-heading" aria-hidden="true">
        <span />
        <strong />
        <i />
      </section>
      <section className="route-loading-panel" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </section>
      <span className="sr-only">Loading page</span>
    </div>
  );
}
