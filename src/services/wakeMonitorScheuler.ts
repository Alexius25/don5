
import { setWakeMonitor } from "./untis.js";
import { publish } from "../mqtt.js";

let displayIsOn: boolean | undefined;
let lastWakeMonitorRun = 0;

async function updateDisplayState(shouldBeOn: boolean) {
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
    const now = new Date();
    const day = now.getDay();
    const minutes = now.getHours() * 60 + now.getMinutes();

    const isWeekday = day >= 1 && day <= 5;
    const isMorning = minutes >= 6 * 60 && minutes < 10 * 60;
    const shouldBeOn = isWeekday && isMorning;

    try {
      await updateDisplayState(shouldBeOn);

      if (shouldBeOn && Date.now() - lastWakeMonitorRun >= 5 * 60 * 1000) {
        await setWakeMonitor();
        lastWakeMonitorRun = Date.now();
      }
    } catch (error) {
      console.error("[Wake Monitor] Fehler:", error);
    } finally {
      setTimeout(() => void tick(), 60 * 1000);
    }
  }

  void tick();
}