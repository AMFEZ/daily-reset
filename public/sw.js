const WORKER_VERSION =
  "daily-reset-push-shell-v2";

const CACHE_PREFIX =
  "daily-reset-shell-";
const SHELL_CACHE =
  `${CACHE_PREFIX}private-${WORKER_VERSION}`;
const STATIC_CACHE =
  `${CACHE_PREFIX}static-${WORKER_VERSION}`;
const FALLBACK_CACHE =
  `${CACHE_PREFIX}fallback-${WORKER_VERSION}`;

const OFFLINE_FALLBACK =
  "/offline.html";
const PRIVATE_SHELL_KEY =
  "/__daily-reset-private-shell__";

const AUTH_PATH_PREFIXES = [
  "/login",
  "/forgot-password",
  "/auth/",
];

self.addEventListener(
  "install",
  (event) => {
    event.waitUntil(
      (async () => {
        const cache =
          await caches.open(
            FALLBACK_CACHE
          );

        await cache.add(
          OFFLINE_FALLBACK
        );

        await self.skipWaiting();
      })()
    );
  }
);

self.addEventListener(
  "activate",
  (event) => {
    event.waitUntil(
      (async () => {
        const cacheNames =
          await caches.keys();

        await Promise.all(
          cacheNames
            .filter(
              (cacheName) =>
                cacheName.startsWith(
                  CACHE_PREFIX
                ) &&
                ![
                  SHELL_CACHE,
                  STATIC_CACHE,
                  FALLBACK_CACHE,
                ].includes(
                  cacheName
                )
            )
            .map((cacheName) =>
              caches.delete(
                cacheName
              )
            )
        );

        if (
          self.registration
            .navigationPreload
        ) {
          await self.registration.navigationPreload.enable();
        }

        await self.clients.claim();
      })()
    );
  }
);

self.addEventListener(
  "message",
  (event) => {
    const message =
      event.data;

    if (
      !message ||
      typeof message !==
        "object"
    ) {
      return;
    }

    if (
      message.type ===
      "CACHE_APP_SHELL"
    ) {
      event.waitUntil(
        warmAppShell({
          url:
            typeof message.url ===
            "string"
              ? message.url
              : "/",
          assets:
            Array.isArray(
              message.assets
            )
              ? message.assets
              : [],
        })
      );
      return;
    }

    if (
      message.type ===
      "CLEAR_PRIVATE_SHELL"
    ) {
      event.waitUntil(
        clearPrivateShell()
      );
    }
  }
);

self.addEventListener(
  "fetch",
  (event) => {
    const request =
      event.request;

    if (
      request.method !== "GET"
    ) {
      return;
    }

    const url =
      new URL(request.url);

    if (
      url.origin !==
      self.location.origin
    ) {
      return;
    }

    if (
      url.pathname.startsWith(
        "/api/"
      )
    ) {
      return;
    }

    if (
      request.mode ===
      "navigate"
    ) {
      event.respondWith(
        handleNavigation(
          event,
          request,
          url
        )
      );
      return;
    }

    if (
      isStaticAsset(url)
    ) {
      event.respondWith(
        cacheFirstStatic(
          request
        )
      );
    }
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
          body:
            payload.body,
          tag:
            payload.tag,
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

async function handleNavigation(
  event,
  request,
  url
) {
  if (
    isAuthenticationPath(
      url.pathname
    )
  ) {
    try {
      const response =
        await fetch(request);

      if (response.ok) {
        await clearPrivateShell();
      }

      return response;
    } catch {
      return getOfflineFallback();
    }
  }

  if (
    url.pathname !== "/"
  ) {
    try {
      const response =
        await fetch(request);

      if (
        isAuthenticationResponse(
          response
        )
      ) {
        await clearPrivateShell();
      }

      return response;
    } catch {
      return getOfflineFallback();
    }
  }

  try {
    const preloadResponse =
      await event.preloadResponse;

    if (
      preloadResponse &&
      preloadResponse.ok
    ) {
      if (
        shouldCachePrivateShell(
          preloadResponse
        )
      ) {
        await cachePrivateShell(
          preloadResponse.clone()
        );
      } else if (
        isAuthenticationResponse(
          preloadResponse
        )
      ) {
        await clearPrivateShell();
      }

      return preloadResponse;
    }

    const networkResponse =
      await fetchWithTimeout(
        request,
        5500
      );

    if (
      shouldCachePrivateShell(
        networkResponse
      )
    ) {
      await cachePrivateShell(
        networkResponse.clone()
      );
    } else if (
      isAuthenticationResponse(
        networkResponse
      )
    ) {
      await clearPrivateShell();
    }

    return networkResponse;
  } catch {
    const cachedShell =
      await getPrivateShell();

    if (cachedShell) {
      return cachedShell;
    }

    return getOfflineFallback();
  }
}

async function warmAppShell({
  url,
  assets,
}) {
  if (
    typeof url !== "string"
  ) {
    return;
  }

  try {
    const target =
      new URL(
        url,
        self.location.origin
      );

    target.pathname = "/";
    target.search = "";
    target.hash = "";

    const response =
      await fetch(
        new Request(
          target.href,
          {
            method: "GET",
            credentials:
              "include",
            cache:
              "no-store",
            redirect:
              "follow",
            headers: {
              Accept:
                "text/html,application/xhtml+xml",
              "X-Daily-Reset-Shell-Warm":
                "1",
            },
          }
        )
      );

    if (
      shouldCachePrivateShell(
        response
      )
    ) {
      await cachePrivateShell(
        response.clone()
      );
    } else if (
      isAuthenticationResponse(
        response
      )
    ) {
      await clearPrivateShell();
    }
  } catch (error) {
    console.error(
      "App shell warm failed:",
      error
    );
  }

  const safeAssets =
    assets
      .filter(
        (asset) =>
          typeof asset ===
          "string"
      )
      .map((asset) => {
        try {
          return new URL(
            asset,
            self.location.origin
          );
        } catch {
          return null;
        }
      })
      .filter(
        (asset) =>
          asset &&
          asset.origin ===
            self.location.origin &&
          isStaticAsset(asset)
      )
      .slice(0, 120);

  if (
    safeAssets.length === 0
  ) {
    return;
  }

  const cache =
    await caches.open(
      STATIC_CACHE
    );

  await Promise.allSettled(
    safeAssets.map(
      async (asset) => {
        const request =
          new Request(
            asset.href,
            {
              credentials:
                "same-origin",
              cache:
                "reload",
            }
          );

        const response =
          await fetch(request);

        if (
          response.ok &&
          response.type !==
            "opaque"
        ) {
          await cache.put(
            request,
            response
          );
        }
      }
    )
  );
}

async function cachePrivateShell(
  response
) {
  const cache =
    await caches.open(
      SHELL_CACHE
    );

  await cache.put(
    privateShellRequest(),
    response
  );
}

async function getPrivateShell() {
  const cache =
    await caches.open(
      SHELL_CACHE
    );

  return (
    (await cache.match(
      privateShellRequest()
    )) ?? null
  );
}

async function clearPrivateShell() {
  await caches.delete(
    SHELL_CACHE
  );
}

function privateShellRequest() {
  return new Request(
    new URL(
      PRIVATE_SHELL_KEY,
      self.location.origin
    ).href,
    {
      method: "GET",
    }
  );
}

async function cacheFirstStatic(
  request
) {
  const cache =
    await caches.open(
      STATIC_CACHE
    );
  const cached =
    await cache.match(request);

  if (cached) {
    return cached;
  }

  const response =
    await fetch(request);

  if (
    response.ok &&
    response.type !==
      "opaque"
  ) {
    await cache.put(
      request,
      response.clone()
    );
  }

  return response;
}

async function getOfflineFallback() {
  const cache =
    await caches.open(
      FALLBACK_CACHE
    );
  const fallback =
    await cache.match(
      OFFLINE_FALLBACK
    );

  if (fallback) {
    return fallback;
  }

  return new Response(
    [
      "<!doctype html>",
      "<html>",
      "<head>",
      '<meta name="viewport" content="width=device-width,initial-scale=1">',
      "<title>Daily Reset Offline</title>",
      "</head>",
      '<body style="background:#000;color:#39ff88;font-family:monospace;padding:24px">',
      "<h1>Daily Reset</h1>",
      "<p>Offline shell unavailable. Reconnect once, open the app, and try again.</p>",
      "</body>",
      "</html>",
    ].join(""),
    {
      status: 503,
      headers: {
        "Content-Type":
          "text/html; charset=utf-8",
      },
    }
  );
}

function shouldCachePrivateShell(
  response
) {
  if (
    !response ||
    !response.ok ||
    response.type ===
      "opaque"
  ) {
    return false;
  }

  const contentType =
    response.headers.get(
      "content-type"
    ) ?? "";

  if (
    !contentType.includes(
      "text/html"
    )
  ) {
    return false;
  }

  try {
    const finalUrl =
      new URL(response.url);

    return (
      finalUrl.origin ===
        self.location.origin &&
      finalUrl.pathname ===
        "/"
    );
  } catch {
    return false;
  }
}

function isAuthenticationResponse(
  response
) {
  if (!response) {
    return false;
  }

  try {
    const finalUrl =
      new URL(response.url);

    return isAuthenticationPath(
      finalUrl.pathname
    );
  } catch {
    return false;
  }
}

function isAuthenticationPath(
  pathname
) {
  return AUTH_PATH_PREFIXES.some(
    (prefix) =>
      pathname ===
        prefix.replace(
          /\/$/,
          ""
        ) ||
      pathname.startsWith(
        prefix
      )
  );
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith(
      "/_next/static/"
    ) ||
    url.pathname.startsWith(
      "/icons/"
    ) ||
    url.pathname ===
      "/manifest.webmanifest" ||
    url.pathname ===
      "/favicon.ico"
  );
}

async function fetchWithTimeout(
  request,
  timeoutMs
) {
  const controller =
    new AbortController();
  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      timeoutMs
    );

  try {
    return await fetch(
      request,
      {
        signal:
          controller.signal,
      }
    );
  } finally {
    clearTimeout(timeout);
  }
}

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
    timestamp:
      Date.now(),
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
      body:
        event.data.text(),
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
        includeUncontrolled:
          true,
      }
    );

  for (
    const client of
    windows
  ) {
    if (
      "navigate" in client
    ) {
      await client.navigate(
        targetUrl
      );
    }

    if (
      "focus" in client
    ) {
      return client.focus();
    }
  }

  return self.clients.openWindow(
    targetUrl
  );
}
