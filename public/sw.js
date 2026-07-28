const WORKER_VERSION =
  "daily-reset-push-v1";

self.addEventListener(
  "install",
  () => {
    self.skipWaiting();
  }
);

self.addEventListener(
  "activate",
  (event) => {
    event.waitUntil(
      self.clients.claim()
    );
  }
);

self.addEventListener(
  "push",
  (event) => {
    const payload =
      readPushPayload(event);

    event.waitUntil(
      self.registration.showNotification(
        payload.title,
        {
          body: payload.body,
          tag: payload.tag,
          icon:
            "/icons/icon-192.png",
          badge:
            "/icons/icon-192.png",
          data: {
            url:
              payload.url || "/",
            workerVersion:
              WORKER_VERSION,
          },
          timestamp:
            payload.timestamp ||
            Date.now(),
        }
      )
    );
  }
);

self.addEventListener(
  "notificationclick",
  (event) => {
    event.notification.close();

    const targetUrl =
      new URL(
        event.notification.data
          ?.url || "/",
        self.location.origin
      ).href;

    event.waitUntil(
      openOrFocusWindow(
        targetUrl
      )
    );
  }
);

function readPushPayload(
  event
) {
  const fallback = {
    title: "Daily Reset",
    body:
      "A Daily Reset signal is ready.",
    tag:
      "daily-reset-signal",
    url: "/",
    timestamp: Date.now(),
  };

  if (!event.data) {
    return fallback;
  }

  try {
    const parsed =
      event.data.json();

    return {
      ...fallback,
      ...parsed,
    };
  } catch {
    return {
      ...fallback,
      body: event.data.text(),
    };
  }
}

async function openOrFocusWindow(
  targetUrl
) {
  const windows =
    await self.clients.matchAll(
      {
        type: "window",
        includeUncontrolled: true,
      }
    );

  for (const client of windows) {
    if ("navigate" in client) {
      await client.navigate(
        targetUrl
      );
    }

    if ("focus" in client) {
      return client.focus();
    }
  }

  return self.clients.openWindow(
    targetUrl
  );
}
