"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100vh",
          margin: 0,
          background: "#000000",
          color: "#e5e5e5",
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
        }}
      >
        <main
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: "24px",
          }}
        >
          <section
            style={{
              width: "100%",
              maxWidth: "640px",
              border: "1px solid #5a1f1f",
              background: "#080404",
            }}
          >
            <header
              style={{
                borderBottom:
                  "1px solid #5a1f1f",
                padding: "12px 16px",
                color: "#ff6b6b",
                fontSize: "12px",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
              }}
            >
              &gt; fatal.system.error
            </header>

            <div
              style={{
                padding: "16px",
              }}
            >
              <h1
                style={{
                  margin: "0 0 16px",
                  color: "#ff6b6b",
                  fontSize: "18px",
                }}
              >
                Daily Reset could not initialize.
              </h1>

              <p
                style={{
                  margin: "0 0 16px",
                  color: "#a3a3a3",
                  fontSize: "14px",
                  lineHeight: 1.7,
                }}
              >
                Retry the application. Your
                existing Supabase records are not
                removed by this error screen.
              </p>

              {error.digest ? (
                <p
                  style={{
                    margin: "0 0 16px",
                    color: "#737373",
                    fontSize: "12px",
                    overflowWrap: "anywhere",
                  }}
                >
                  &gt; error_id: {error.digest}
                </p>
              ) : null}

              <button
                type="button"
                onClick={reset}
                style={{
                  minHeight: "44px",
                  border: "1px solid #39ff88",
                  background: "transparent",
                  color: "#39ff88",
                  padding: "0 16px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                restart application
              </button>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
