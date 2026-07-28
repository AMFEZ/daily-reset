import type {
  SupabaseClient,
} from "@supabase/supabase-js";
import {
  createClient,
} from "@/utils/supabase/server";

type SubscriptionInput = {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export async function POST(
  request: Request
) {
  const authClient =
    await createClient();

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser();

  if (userError || !user) {
    return Response.json(
      {
        error:
          "Authentication required.",
      },
      {
        status: 401,
        headers: noStoreHeaders(),
      }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      {
        error:
          "The push subscription was not valid JSON.",
      },
      {
        status: 400,
        headers: noStoreHeaders(),
      }
    );
  }

  const parsed =
    parseSubscription(body);

  if (!parsed.ok) {
    return Response.json(
      {
        error: parsed.error,
      },
      {
        status: 400,
        headers: noStoreHeaders(),
      }
    );
  }

  const database =
    authClient as unknown as SupabaseClient;

  const now =
    new Date().toISOString();

  const {
    data,
    error,
  } = await database
    .from(
      "daily_reset_push_subscriptions"
    )
    .upsert(
      {
        user_id: user.id,
        endpoint:
          parsed.subscription.endpoint,
        p256dh:
          parsed.subscription.keys.p256dh,
        auth_secret:
          parsed.subscription.keys.auth,
        expiration_time:
          parsed.subscription.expirationTime
            ? new Date(
                parsed.subscription.expirationTime
              ).toISOString()
            : null,
        user_agent:
          request.headers.get(
            "user-agent"
          ),
        enabled: true,
        last_seen_at: now,
      },
      {
        onConflict: "endpoint",
      }
    )
    .select("id, endpoint, enabled")
    .single();

  if (error) {
    console.error(
      "Push subscription save failed:",
      error.message
    );

    return Response.json(
      {
        error: error.message,
      },
      {
        status: 500,
        headers: noStoreHeaders(),
      }
    );
  }

  return Response.json(
    {
      subscription: data,
    },
    {
      status: 200,
      headers: noStoreHeaders(),
    }
  );
}

export async function DELETE(
  request: Request
) {
  const authClient =
    await createClient();

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser();

  if (userError || !user) {
    return Response.json(
      {
        error:
          "Authentication required.",
      },
      {
        status: 401,
        headers: noStoreHeaders(),
      }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const endpoint =
    body &&
    typeof body === "object" &&
    typeof (
      body as Record<string, unknown>
    ).endpoint === "string"
      ? String(
          (
            body as Record<
              string,
              unknown
            >
          ).endpoint
        ).trim()
      : "";

  if (!endpoint) {
    return Response.json(
      {
        error:
          "A push endpoint is required.",
      },
      {
        status: 400,
        headers: noStoreHeaders(),
      }
    );
  }

  const database =
    authClient as unknown as SupabaseClient;

  const { error } = await database
    .from(
      "daily_reset_push_subscriptions"
    )
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);

  if (error) {
    return Response.json(
      {
        error: error.message,
      },
      {
        status: 500,
        headers: noStoreHeaders(),
      }
    );
  }

  return Response.json(
    {
      removed: true,
    },
    {
      status: 200,
      headers: noStoreHeaders(),
    }
  );
}

function parseSubscription(
  body: unknown
):
  | {
      ok: true;
      subscription: SubscriptionInput;
    }
  | {
      ok: false;
      error: string;
    } {
  if (
    !body ||
    typeof body !== "object"
  ) {
    return {
      ok: false,
      error:
        "A push subscription is required.",
    };
  }

  const candidate =
    body as Record<string, unknown>;
  const subscription =
    candidate.subscription;

  if (
    !subscription ||
    typeof subscription !== "object"
  ) {
    return {
      ok: false,
      error:
        "A push subscription is required.",
    };
  }

  const value =
    subscription as Record<
      string,
      unknown
    >;
  const endpoint =
    typeof value.endpoint === "string"
      ? value.endpoint.trim()
      : "";
  const keys =
    value.keys;

  if (
    !endpoint.startsWith("https://") ||
    !keys ||
    typeof keys !== "object"
  ) {
    return {
      ok: false,
      error:
        "The push subscription is invalid.",
    };
  }

  const keyValues =
    keys as Record<string, unknown>;
  const p256dh =
    typeof keyValues.p256dh === "string"
      ? keyValues.p256dh.trim()
      : "";
  const auth =
    typeof keyValues.auth === "string"
      ? keyValues.auth.trim()
      : "";

  if (!p256dh || !auth) {
    return {
      ok: false,
      error:
        "The push subscription keys are missing.",
    };
  }

  const expirationTime =
    typeof value.expirationTime ===
    "number"
      ? value.expirationTime
      : null;

  return {
    ok: true,
    subscription: {
      endpoint,
      expirationTime,
      keys: {
        p256dh,
        auth,
      },
    },
  };
}

function noStoreHeaders() {
  return {
    "Cache-Control":
      "no-store, max-age=0",
  };
}
