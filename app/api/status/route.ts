import { DAILY_RESET_RELEASE } from "@/lib/release";

export const dynamic = "force-dynamic";

export function GET() {
  const environment =
    process.env.VERCEL_ENV ??
    (process.env.NODE_ENV === "production"
      ? "production"
      : "development");

  const deploymentHost =
    process.env
      .VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL ??
    null;

  const commitSha =
    process.env.VERCEL_GIT_COMMIT_SHA ??
    null;

  return Response.json(
    {
      ok: true,
      service: "daily-reset",
      release: DAILY_RESET_RELEASE,
      deployment: {
        environment,
        host: deploymentHost,
        commit:
          commitSha?.slice(0, 8) ?? null,
        branch:
          process.env
            .VERCEL_GIT_COMMIT_REF ??
          null,
      },
      generated_at:
        new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "Cache-Control":
          "public, max-age=0, must-revalidate",
        "X-Content-Type-Options":
          "nosniff",
      },
    }
  );
}
