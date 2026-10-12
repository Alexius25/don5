import { fetchAllTimetables } from "./untis.js";

let lastTimetableRun = 0;

export function startTimetableScheduler() {
  async function tick() {
    try {
      if (Date.now() - lastTimetableRun >= 5 * 60 * 1000) {
        await fetchAllTimetables();
        lastTimetableRun = Date.now();
        console.log("[Timetable] Aktualisierung abgeschlossen");
      }
    } catch (error) {
      console.error("[Timetable] Fehler:", error);
    } finally {
      setTimeout(() => void tick(), 60 * 1000);
    }
  }

  void tick();
}
