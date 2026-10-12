import { setWakeMonitor } from "./untis.js";
import { publish } from "../mqtt.js";

let displayIsOn: boolean | undefined;
let lastWakeMonitorRun = 0;

async function updateDisplayState(shouldBeOn: boolean) {
  // Publish only when the desired state differs from our last
  // successfully published state.
  if (displayIsOn === shouldBeOn) return;

  await publish(
    "esp/lcd/cmd",
    JSON.stringify({ cmd: shouldBeOn ? "on" : "off" }),
  );

  displayIsOn = shouldBeOn;
  console.log(`[LCD] Display ${shouldBeOn ? "on" : "off"}`);
}

export function startWakeMonitorScheduler() {
  async function tick() {
    try {
      const now = new Date();
      const day = now.getDay();
      const minutes = now.getHours() * 60 + now.getMinutes();

      const isWeekday = day >= 1 && day <= 5;
      const shouldBeOn =
        isWeekday && minutes >= 6 * 60 && minutes < 10 * 60;

      await updateDisplayState(shouldBeOn);

      if (
        shouldBeOn &&
        Date.now() - lastWakeMonitorRun >= 5 * 60 * 1000
      ) {
        await setWakeMonitor();
        lastWakeMonitorRun = Date.now();
      }
    } catch (error) {
      console.error("[Wake Monitor] Fehler:", error);
    } finally {
      setTimeout(() => void tick(), 10 * 1000);
    }
  }

  void tick();
}