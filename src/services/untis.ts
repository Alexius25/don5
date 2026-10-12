import { publish, subscribe } from "../mqtt.js";
import WebUntis from "webuntisrest";
import { env } from "../config.js";

const untisAlex = new WebUntis(
  env.WEBUNTIS_SCHOOL_ALEX,
  env.WEBUNTIS_USERNAME_ALEX,
  env.WEBUNTIS_PASSWORD_ALEX,
  env.WEBUNTIS_BASE_URL_ALEX,
);

const untisJonathan = new WebUntis(
  env.WEBUNTIS_SCHOOL_JONATHAN,
  env.WEBUNTIS_USERNAME_JONATHAN,
  env.WEBUNTIS_PASSWORD_JONATHAN,

  env.WEBUNTIS_BASE_URL_JONATHAN,
);

// Fetch timetable for both users and publish to MQTT. If the last lesson of the day has passed, fetch the timetable for the next day instead.
async function fetchAndPublishTimetable(untis: WebUntis, user: string) {
  await untis.login();

  console.log(`[Untis] Starting timetable fetch for ${user}`);

  const now = new Date();
  const topic = `untis/${user}/timetable`;

  const publishStatus = async (
    status: "OK" | "NEXT_DAY" | "FERIEN" | "WOCHENENDE",
    entries?: unknown[],
  ) => {
    await publish(
      topic,
      JSON.stringify({
        status,
        ...(entries !== undefined ? { entries } : {}),
      }),
    );

    console.log(`[Untis] Published ${status} for ${user}`);
  };

  const formatDate = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  const isWeekend = (date: Date) => date.getDay() === 0 || date.getDay() === 6;

  // If today is a weekend, publish the corresponding status.
  if (isWeekend(now)) {
    await publishStatus("WOCHENENDE");
    return;
  }

  // If today is a holiday, publish the corresponding status.
  if (await untis.calendarService.isHoliday(now)) {
    await publishStatus("FERIEN");
    return;
  }

  // Fetch today's timetable.
  const today = formatDate(now);
  const timetable = await untis.timetableService.getOwnTimetable(today, today);

  const todayEntries = timetable.days[0]?.gridEntries ?? [];

  if (todayEntries.length > 0) {
    const lastLesson = todayEntries.reduce((latest, current) =>
      new Date(current.duration.end).getTime() >
      new Date(latest.duration.end).getTime()
        ? current
        : latest,
    );

    if (now < new Date(lastLesson.duration.end)) {
      await publishStatus("OK", todayEntries);
      return;
    }
  }

  // Today's lessons are over (or there are no entries).
  // Find the next school day, skipping weekends and holidays.
  for (let offset = 1; offset <= 14; offset++) {
    const nextDate = new Date(now);
    nextDate.setDate(now.getDate() + offset);

    if (isWeekend(nextDate)) {
      continue;
    }

    if (await untis.calendarService.isHoliday(nextDate)) {
      continue;
    }

    const dateString = formatDate(nextDate);
    const nextTimetable = await untis.timetableService.getOwnTimetable(
      dateString,
      dateString,
    );

    const nextEntries = nextTimetable.days[0]?.gridEntries ?? [];

    if (nextEntries.length > 0) {
      await publishStatus("NEXT_DAY", nextEntries);
      return;
    }
  }

  console.log(`[Untis] No timetable found within 14 days for ${user}`);
  await publishStatus("NEXT_DAY", []);
}

export async function setWakeMonitor() {
  await untisAlex.login();
  await untisJonathan.login();

  console.log("[Wake Monitor] Setting up wake monitor");

  const firstLessonAlex = await getNextFirstLesson(untisAlex, "Alex");
  const firstLessonJonathan = await getNextFirstLesson(
    untisJonathan,
    "Jonathan",
  );

  if (!firstLessonAlex || !firstLessonJonathan) {
    console.log("[Wake Monitor] Could not determine both lesson start times.");
    return;
  }

  const alexStart = new Date(firstLessonAlex.duration.start);
  const jonathanStart = new Date(firstLessonJonathan.duration.start);

  await publish(
    "esp/lcd/set",
    JSON.stringify({
      line1:
        "  Alex -- " +
        alexStart.getHours().toString().padStart(2, "0") +
        ":" +
        alexStart.getMinutes().toString().padStart(2, "0"),
      line2:
        "  Joni -- " +
        jonathanStart.getHours().toString().padStart(2, "0") +
        ":" +
        jonathanStart.getMinutes().toString().padStart(2, "0"),
    }),
  );
}

async function getNextFirstLesson(untis: WebUntis, name: string) {
  const now = Date.now();

  const getFirstLesson = async (
    timetable: Awaited<
      ReturnType<typeof untis.timetableService.getOwnTimetableToday>
    >,
  ) =>
    timetable.days[0]?.gridEntries
      ?.sort(
        (a, b) =>
          new Date(a.duration.start).getTime() -
          new Date(b.duration.start).getTime(),
      )
      .find((lesson) => new Date(lesson.duration.start).getTime() > now);

  let lesson = await getFirstLesson(
    await untis.timetableService.getOwnTimetableToday(),
  );

  if (!lesson) {
    console.log(
      `[Wake Monitor] No upcoming lessons found for ${name} today. Checking tomorrow's timetable.`,
    );

    const tomorrow = await untis.timetableService.getOwnTimetableTomorrow();

    lesson = tomorrow.days[0]?.gridEntries?.sort(
      (a, b) =>
        new Date(a.duration.start).getTime() -
        new Date(b.duration.start).getTime(),
    )[0];
  }

  if (!lesson) {
    console.log(
      `[Wake Monitor] No lessons found for ${name} today or tomorrow.`,
    );
  }

  console.log(
    `[Wake Monitor] ${name}: Next lesson starts at ${
      lesson
        ? new Date(lesson.duration.start).toLocaleString("de-DE")
        : "not found"
    }`,
  );

  return lesson;
}

export async function fetchAllTimetables() {
  await fetchAndPublishTimetable(untisAlex, "alex");
  await fetchAndPublishTimetable(untisJonathan, "jonathan");
}

export async function testWakeMonitor() {
  console.log("[Wake Monitor] Test gestartet");

  try {
    // Display einschalten
    await publish("esp/lcd/cmd", JSON.stringify({ cmd: "on" }));

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Wake Monitor ausführen
    await setWakeMonitor();

    // 15 Sekunden warten
    console.log("[Wake Monitor] Warte 15 Sekunden ...");
    await new Promise((resolve) => setTimeout(resolve, 15_000));

    // Display wieder ausschalten
    await publish("esp/lcd/cmd", JSON.stringify({ cmd: "off" }));

    console.log("[Wake Monitor] Test erfolgreich abgeschlossen");
  } catch (error) {
    console.error("[Wake Monitor] Test fehlgeschlagen:", error);
    throw error;
  }
}
