import { publish, subscribe } from "../mqtt.js";
import WebUntis from "webuntisrest";
import { env } from "../config.js";

const untisAlex = new WebUntis(
  env.WEBUNTIS_SCHOOL_ALEX,
  env.WEBUNTIS_USERNAME_ALEX,
  env.WEBUNTIS_PASSWORD_ALEX,
  env.WEBUNTIS_BASE_URL_ALEX,
);
await untisAlex.login();

const untisJonathan = new WebUntis(
  env.WEBUNTIS_SCHOOL_JONATHAN,
  env.WEBUNTIS_USERNAME_JONATHAN,
  env.WEBUNTIS_PASSWORD_JONATHAN,

  env.WEBUNTIS_BASE_URL_JONATHAN,
);
await untisJonathan.login();

// Fetch timetable for both users and publish to MQTT. If the last lesson of the day has passed, fetch the timetable for the next day instead.
export async function fetchAndPublishTimetable(untis: WebUntis, user: string) {
  console.log(`[Untis] Starting timetable fetch for ${user}`);
  let timetable = await untis.timetableService.getOwnTimetableToday();
  let gridEntries = timetable.days[0]?.gridEntries ?? [];

  const now = new Date();

  if (gridEntries.length === 0) {
    console.log(`[Untis] No lessons found for ${user} today.`);
  } else {
    const lastLesson = gridEntries.reduce((latest, current) =>
      new Date(current.duration.end).getTime() >
      new Date(latest.duration.end).getTime()
        ? current
        : latest,
    );

    if (now > new Date(lastLesson.duration.end)) {
      console.log(`[Untis] Last lesson for ${user} has passed.`);
    } else {
      console.log(`[Untis] Fetching today's timetable for ${user}.`);
      await publish(`untis/${user}/timetable`, JSON.stringify(gridEntries));
      return;
    }
  }

  console.log(`[Untis] Fetching tomorrow's timetable for ${user}.`);

  timetable = await untis.timetableService.getOwnTimetableTomorrow();
  gridEntries = timetable.days[0]?.gridEntries ?? [];

  console.log(`[Untis] Publishing ${gridEntries.length} entries for ${user}`);

  await publish(`untis/${user}/timetable`, JSON.stringify(gridEntries));

  console.log(`[Untis] Published timetable for ${user}`);
}

export async function setWakeMonitor() {
    console.log("[Untis] Setting up wake monitor");

    // Get the start time of the first lesson of the day
    let firstLessonAlex = (await untisAlex.timetableService.getOwnTimetableToday()).days[0]?.gridEntries?.sort((a, b) => new Date(a.duration.start).getTime() - new Date(b.duration.start).getTime())[0];
    if (!firstLessonAlex) {
        console.log("[Untis] No lessons found for Alex today. Checking tomorrow's timetable.");
        firstLessonAlex = (await untisAlex.timetableService.getOwnTimetableTomorrow()).days[0]?.gridEntries?.sort((a, b) => new Date(a.duration.start).getTime() - new Date(b.duration.start).getTime())[0];
        if (!firstLessonAlex) {
            console.log("[Untis] No lessons found for Alex tomorrow.");
            return;
        }
    }
    const firstLessonStartAlex = new Date(firstLessonAlex.duration.start);

    let firstLessonJonathan = (await untisJonathan.timetableService.getOwnTimetableToday()).days[0]?.gridEntries?.sort((a, b) => new Date(a.duration.start).getTime() - new Date(b.duration.start).getTime())[0];
    if (!firstLessonJonathan) {
        console.log("[Untis] No lessons found for Jonathan today. Checking tomorrow's timetable.");
        firstLessonJonathan = (await untisJonathan.timetableService.getOwnTimetableTomorrow()).days[0]?.gridEntries?.sort((a, b) => new Date(a.duration.start).getTime() - new Date(b.duration.start).getTime())[0];
        if (!firstLessonJonathan) {
            console.log("[Untis] No lessons found for Jonathan tomorrow.");
            return;
        }
    }
    const firstLessonStartJonathan = new Date(firstLessonJonathan.duration.start);

    await publish("esp/lcd/set", JSON.stringify({
        "line1": "  Alex: " + firstLessonStartAlex.getHours().toString().padStart(2, "0") + ":" + firstLessonStartAlex.getMinutes().toString().padStart(2, "0"),
        "line2": "  Joni: " + firstLessonStartJonathan.getHours().toString().padStart(2, "0") + ":" + firstLessonStartJonathan.getMinutes().toString().padStart(2, "0")
    }));
}


fetchAndPublishTimetable(untisAlex, "alex");
fetchAndPublishTimetable(untisJonathan, "jonathan");

setWakeMonitor().catch((error) => {
    console.error("[Untis] Wake monitor failed:", error);
});