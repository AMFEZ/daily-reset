import webPush from "web-push";

export type StoredPushSubscription = {
  endpoint: string;
  p256dh: string;
  auth_secret: string;
};

export type DailyResetPushPayload = {
  title: string;
  body: string;
  tag: string;
  url: string;
  timestamp?: number;
};

let configured = false;

function configureWebPush() {
  if (configured) {
    return;
  }

  const subject =
    process.env.VAPID_SUBJECT;
  const publicKey =
    process.env.VAPID_PUBLIC_KEY;
  const privateKey =
    process.env.VAPID_PRIVATE_KEY;

  if (
    !subject ||
    !publicKey ||
    !privateKey
  ) {
    throw new Error(
      "Missing VAPID environment variables."
    );
  }

  webPush.setVapidDetails(
    subject,
    publicKey,
    privateKey
  );

  configured = true;
}

export async function sendPushNotification(
  subscription: StoredPushSubscription,
  payload: DailyResetPushPayload
) {
  configureWebPush();

  return webPush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth_secret,
      },
    },
    JSON.stringify(payload),
    {
      TTL: 60 * 60,
      urgency: "normal",
    }
  );
}

export function isExpiredPushSubscription(
  error: unknown
) {
  if (
    !error ||
    typeof error !== "object"
  ) {
    return false;
  }

  const statusCode =
    "statusCode" in error
      ? Number(
          (
            error as {
              statusCode?: unknown;
            }
          ).statusCode
        )
      : 0;

  return (
    statusCode === 404 ||
    statusCode === 410
  );
}

export function getPushErrorMessage(
  error: unknown
) {
  if (error instanceof Error) {
    return error.message.slice(0, 500);
  }

  return String(error).slice(0, 500);
}
