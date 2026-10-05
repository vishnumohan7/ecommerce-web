/* eslint-disable local/no-jsx-literals -- Milestone 17 preview copy is English-only until the localisation catalogue lands. */
export function ApiNotice({
  message,
  compact = false,
}: Readonly<{ message: string; compact?: boolean }>) {
  return (
    <div className={`api-notice${compact ? ' compact' : ''}`} role="status">
      <span aria-hidden="true">!</span>
      <div>
        <strong>Live data is temporarily unavailable</strong>
        <p>
          {message} Start the API service and refresh this page; the admin preview itself remains
          usable.
        </p>
      </div>
    </div>
  );
}
