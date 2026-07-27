import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type HealthCheck = {
  configured: boolean;
};

export async function GET() {
  const checks: Record<string, HealthCheck> = {
    supabaseUrl: {
      configured: Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL
      ),
    },
    supabasePublicKey: {
      configured: Boolean(
        process.env
          .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
          process.env
            .NEXT_PUBLIC_SUPABASE_ANON_KEY
      ),
    },
    openAi: {
      configured: Boolean(
        process.env.OPENAI_API_KEY
      ),
    },
  };

  const healthy = Object.values(checks).every(
    (check) => check.configured
  );

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      service: "daily-reset",
      environment:
        process.env.VERCEL_ENV ??
        process.env.NODE_ENV ??
        "unknown",
      commit:
        process.env.VERCEL_GIT_COMMIT_SHA?.slice(
          0,
          7
        ) ?? null,
      timestamp: new Date().toISOString(),
      checks,
    },
    {
      status: healthy ? 200 : 503,
      headers: {
        "Cache-Control":
          "no-store, max-age=0",
      },
    }
  );
}
