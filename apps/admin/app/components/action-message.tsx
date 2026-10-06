export function ActionMessage({
  success,
  error,
}: Readonly<{ success?: string | undefined; error?: string | undefined }>) {
  if (!success && !error) return null;
  return (
    <div className={`action-message ${error ? 'is-error' : 'is-success'}`} role="status">
      {error ?? success}
    </div>
  );
}
