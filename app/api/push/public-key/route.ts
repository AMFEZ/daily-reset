export const dynamic = "force-dynamic";

export async function GET() {
  const publicKey =
    process.env.VAPID_PUBLIC_KEY;

  if (!publicKey) {
    return Response.json(
      {
        error:
          "Push notifications are not configured.",
      },
      {
        status: 503,
        headers: noStoreHeaders(),
      }
    );
  }

  return Response.json(
    {
      publicKey,
    },
    {
      status: 200,
      headers: noStoreHeaders(),
    }
  );
}

function noStoreHeaders() {
  return {
    "Cache-Control":
      "no-store, max-age=0",
  };
}
