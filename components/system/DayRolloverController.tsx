"use client";

import {
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useRouter } from "next/navigation";

type DayRolloverControllerProps = {
  serverDayKey: string;
  timeZone: string;
};

const ROLLOVER_SESSION_KEY =
  "daily-reset:last-rollover-refresh";

export function DayRolloverController({
  serverDayKey,
  timeZone,
}: DayRolloverControllerProps) {
  const router = useRouter();
  const timerRef =
    useRef<number | null>(null);
  const refreshRequestedRef =
    useRef(false);

  const refreshForNewDay =
    useCallback(() => {
      const browserDayKey =
        getDayKey(timeZone);

      if (
        browserDayKey === serverDayKey
      ) {
        return false;
      }

      if (refreshRequestedRef.current) {
        return true;
      }

      const lastRefreshedDay =
        readSessionValue(
          ROLLOVER_SESSION_KEY
        );

      if (
        lastRefreshedDay ===
        browserDayKey
      ) {
        return true;
      }

      refreshRequestedRef.current =
        true;

      writeSessionValue(
        ROLLOVER_SESSION_KEY,
        browserDayKey
      );

      router.refresh();
      return true;
    }, [
      router,
      serverDayKey,
      timeZone,
    ]);

  useEffect(() => {
    let isActive = true;

    function clearTimer() {
      if (timerRef.current) {
        window.clearTimeout(
          timerRef.current
        );
        timerRef.current = null;
      }
    }

    function scheduleNextRollover() {
      clearTimer();

      if (
        !isActive ||
        refreshForNewDay()
      ) {
        return;
      }

      const delay =
        getMillisecondsUntilNextDay(
          timeZone
        );

      timerRef.current =
        window.setTimeout(() => {
          timerRef.current = null;

          if (
            !refreshForNewDay()
          ) {
            scheduleNextRollover();
          }
        }, delay);
    }

    function handleAppResume() {
      scheduleNextRollover();
    }

    function handleVisibilityChange() {
      if (
        document.visibilityState ===
        "visible"
      ) {
        handleAppResume();
      }
    }

    scheduleNextRollover();

    window.addEventListener(
      "focus",
      handleAppResume
    );
    window.addEventListener(
      "pageshow",
      handleAppResume
    );
    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      isActive = false;
      clearTimer();

      window.removeEventListener(
        "focus",
        handleAppResume
      );
      window.removeEventListener(
        "pageshow",
        handleAppResume
      );
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, [
    refreshForNewDay,
    timeZone,
  ]);

  return null;
}

function getDayKey(
  timeZone: string,
  date = new Date()
) {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    ).formatToParts(date);

  const values =
    Object.fromEntries(
      parts
        .filter(
          (part) =>
            part.type !== "literal"
        )
        .map((part) => [
          part.type,
          part.value,
        ])
    );

  return [
    values.year,
    values.month,
    values.day,
  ].join("-");
}

function getMillisecondsUntilNextDay(
  timeZone: string
) {
  const now = Date.now();
  const currentDayKey = getDayKey(
    timeZone,
    new Date(now)
  );

  let low = now;
  let high =
    now + 36 * 60 * 60 * 1000;

  if (
    getDayKey(
      timeZone,
      new Date(high)
    ) === currentDayKey
  ) {
    high =
      now + 48 * 60 * 60 * 1000;
  }

  while (high - low > 1_000) {
    const midpoint =
      Math.floor((low + high) / 2);

    if (
      getDayKey(
        timeZone,
        new Date(midpoint)
      ) === currentDayKey
    ) {
      low = midpoint;
    } else {
      high = midpoint;
    }
  }

  return Math.max(
    1_000,
    high - now + 250
  );
}

function readSessionValue(
  key: string
) {
  try {
    return window.sessionStorage.getItem(
      key
    );
  } catch {
    return null;
  }
}

function writeSessionValue(
  key: string,
  value: string
) {
  try {
    window.sessionStorage.setItem(
      key,
      value
    );
  } catch {
    // The date comparison still prevents
    // normal same-day refreshes if browser
    // storage is unavailable.
  }
}
