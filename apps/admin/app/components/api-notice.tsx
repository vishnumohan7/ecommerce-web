/* eslint-disable local/no-jsx-literals -- Operations copy is English-only. */
export function ApiNotice({
  message,
  compact = false,
}: Readonly<{ message: string; compact?: boolean }>) {
  return (
    <div className={`api-notice${compact ? ' compact' : ''}`} role="status">
      <span aria-hidden="true">!</span>
      <div>
        <strong>Live data is temporarily unavailable</strong>
        <p>{message} Refresh the page or check System health for dependency status.</p>
      </div>
    </div>
  );
}
