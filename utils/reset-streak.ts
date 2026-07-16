const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export type ResetStreakState =
  | "empty"
  | "saved_today"
  | "open_today"
  | "broken";

export type ResetStreakStats = {
  currentStreak: number;
  bestStreak: number;
  totalSavedDays: number;
  savedLast7: number;
  lastSavedDate: string | null;
  consistencyStatus: string;
  statusMessage: string;
  state: ResetStreakState;
};

function dateKeyToDayNumber(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const milliseconds = Date.UTC(year, month - 1, day);
  const normalizedDate = new Date(milliseconds)
    .toISOString()
    .slice(0, 10);

  if (normalizedDate !== dateKey) {
    return null;
  }

  return Math.floor(milliseconds / MILLISECONDS_PER_DAY);
}

function getConsistencyStatus(savedLast7: number) {
  if (savedLast7 === 7) return "LOCKED IN";
  if (savedLast7 >= 5) return "CONSISTENCY ONLINE";
  if (savedLast7 >= 3) return "PATTERN FORMING";
  if (savedLast7 >= 1) return "SIGNAL STARTED";

  return "RESET REQUIRED";
}

function getStatusMessage(
  state: ResetStreakState,
  currentStreak: number
) {
  if (state === "empty") {
    return "Save one daily reset to initialize the streak engine.";
  }

  if (state === "saved_today") {
    return `Today's reset is saved. ${currentStreak}-day chain secured.`;
  }

  if (state === "open_today") {
    return "The streak is still active. Save today's reset to extend it.";
  }

  return "The previous chain ended. Save today to begin the next sequence.";
}

export function calculateResetStreak(
  dateValues: Array<string | null | undefined>,
  todayKey = new Date().toISOString().slice(0, 10)
): ResetStreakStats {
  const uniqueDates = Array.from(
    new Set(
      dateValues.filter(
        (date): date is string =>
          typeof date === "string" &&
          dateKeyToDayNumber(date) !== null
      )
    )
  ).sort();

  const dayNumbers = uniqueDates
    .map(dateKeyToDayNumber)
    .filter((day): day is number => day !== null);

  const todayDayNumber = dateKeyToDayNumber(todayKey);

  if (todayDayNumber === null || dayNumbers.length === 0) {
    return {
      currentStreak: 0,
      bestStreak: 0,
      totalSavedDays: 0,
      savedLast7: 0,
      lastSavedDate: null,
      consistencyStatus: "RESET REQUIRED",
      statusMessage:
        "Save one daily reset to initialize the streak engine.",
      state: "empty",
    };
  }

  const latestDay = dayNumbers[dayNumbers.length - 1];
  const lastSavedDate = uniqueDates[uniqueDates.length - 1];

  let state: ResetStreakState = "broken";

  if (latestDay === todayDayNumber) {
    state = "saved_today";
  } else if (latestDay === todayDayNumber - 1) {
    state = "open_today";
  }

  let currentStreak = 0;

  if (state === "saved_today" || state === "open_today") {
    let expectedDay = latestDay;

    for (
      let index = dayNumbers.length - 1;
      index >= 0;
      index -= 1
    ) {
      if (dayNumbers[index] !== expectedDay) {
        break;
      }

      currentStreak += 1;
      expectedDay -= 1;
    }
  }

  let bestStreak = 0;
  let runningStreak = 0;
  let previousDay: number | null = null;

  for (const dayNumber of dayNumbers) {
    if (
      previousDay !== null &&
      dayNumber === previousDay + 1
    ) {
      runningStreak += 1;
    } else {
      runningStreak = 1;
    }

    bestStreak = Math.max(bestStreak, runningStreak);
    previousDay = dayNumber;
  }

  const sevenDayStart = todayDayNumber - 6;

  const savedLast7 = dayNumbers.filter(
    (dayNumber) =>
      dayNumber >= sevenDayStart &&
      dayNumber <= todayDayNumber
  ).length;

  return {
    currentStreak,
    bestStreak,
    totalSavedDays: dayNumbers.length,
    savedLast7,
    lastSavedDate,
    consistencyStatus: getConsistencyStatus(savedLast7),
    statusMessage: getStatusMessage(state, currentStreak),
    state,
  };
}