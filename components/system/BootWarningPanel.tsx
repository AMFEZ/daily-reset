type BootWarningPanelProps = {
  warnings: string[];
};

export function BootWarningPanel({
  warnings,
}: BootWarningPanelProps) {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <div className="px-3 pt-3 sm:px-4 sm:pt-4 md:px-6">
      <details className="border border-[#5a4218] bg-[#120d04] font-mono text-xs text-[#ffb020]">
        <summary className="min-h-[44px] cursor-pointer px-3 py-3 transition hover:bg-[#1a1206] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#ffb020] focus-visible:ring-inset">
          &gt; partial boot:{" "}
          {warnings.length} optional module
          {warnings.length === 1
            ? ""
            : "s"}{" "}
          unavailable
        </summary>

        <div className="border-t border-[#5a4218] px-3 py-3">
          <p className="leading-5">
            Core protocols are available. The
            modules below loaded with empty data
            and can be retried by refreshing later.
          </p>

          <ul className="mt-3 space-y-2 text-[#d6a44b]">
            {warnings.map(
              (warning, index) => (
                <li
                  key={`${warning}-${index}`}
                  className="break-words"
                >
                  &gt; {warning}
                </li>
              )
            )}
          </ul>
        </div>
      </details>
    </div>
  );
}
