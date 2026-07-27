import {
  createServerClient,
} from "@supabase/ssr";
import {
  NextResponse,
  type NextRequest,
} from "next/server";
import type {
  Database,
} from "@/types/database.types";

const USER_ID_HEADER =
  "x-daily-reset-user-id";
const USER_EMAIL_HEADER =
  "x-daily-reset-user-email";

function getSupabasePublicKey() {
  return (
    process.env
      .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env
      .NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

function copyResponseCookies(
  source: NextResponse,
  target: NextResponse
) {
  for (
    const cookie of
    source.cookies.getAll()
  ) {
    target.cookies.set(cookie);
  }

  return target;
}

function loginRedirect(
  request: NextRequest,
  responseWithCookies: NextResponse,
  message?: string
) {
  const destination =
    request.nextUrl.clone();

  destination.pathname = "/login";
  destination.search = "";

  if (message) {
    destination.searchParams.set(
      "message",
      message
    );
  }

  return copyResponseCookies(
    responseWithCookies,
    NextResponse.redirect(destination)
  );
}

export async function updateSession(
  request: NextRequest
) {
  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublicKey =
    getSupabasePublicKey();

  if (
    !supabaseUrl ||
    !supabasePublicKey
  ) {
    return loginRedirect(
      request,
      NextResponse.next(),
      "Supabase environment variables are missing."
    );
  }

  let supabaseResponse =
    NextResponse.next({
      request,
    });

  const supabase =
    createServerClient<Database>(
      supabaseUrl,
      supabasePublicKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            for (
              const {
                name,
                value,
              } of cookiesToSet
            ) {
              request.cookies.set(
                name,
                value
              );
            }

            supabaseResponse =
              NextResponse.next({
                request,
              });

            for (
              const {
                name,
                value,
                options,
              } of cookiesToSet
            ) {
              supabaseResponse.cookies.set(
                name,
                value,
                options
              );
            }
          },
        },
      }
    );

  const {
    data,
    error,
  } = await supabase.auth.getClaims();

  const claims = data?.claims;
  const userId =
    typeof claims?.sub === "string"
      ? claims.sub
      : null;
  const userEmail =
    typeof claims?.email === "string"
      ? claims.email
      : null;
  const isLoginRoute =
    request.nextUrl.pathname ===
    "/login";

  if (error || !userId) {
    if (isLoginRoute) {
      return supabaseResponse;
    }

    const isRateLimited =
      error?.status === 429 ||
      error?.message
        ?.toLowerCase()
        .includes("rate limit") ||
      error?.message
        ?.toLowerCase()
        .includes(
          "too many requests"
        );

    return loginRedirect(
      request,
      supabaseResponse,
      isRateLimited
        ? "Authentication is temporarily rate-limited. Please retry shortly."
        : "Please sign in to continue."
    );
  }

  if (isLoginRoute) {
    const destination =
      request.nextUrl.clone();

    destination.pathname = "/";
    destination.search = "";

    return copyResponseCookies(
      supabaseResponse,
      NextResponse.redirect(
        destination
      )
    );
  }

  const downstreamHeaders =
    new Headers(request.headers);

  downstreamHeaders.delete(
    USER_ID_HEADER
  );
  downstreamHeaders.delete(
    USER_EMAIL_HEADER
  );
  downstreamHeaders.set(
    USER_ID_HEADER,
    userId
  );

  if (userEmail) {
    downstreamHeaders.set(
      USER_EMAIL_HEADER,
      userEmail
    );
  }

  const verifiedResponse =
    NextResponse.next({
      request: {
        headers:
          downstreamHeaders,
      },
    });

  return copyResponseCookies(
    supabaseResponse,
    verifiedResponse
  );
}
