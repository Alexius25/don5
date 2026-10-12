import "dotenv/config";
import { app } from "./api.js";
import { startMqtt, stopMqtt } from "./mqtt.js";
import { testWakeMonitor } from "./services/untis.js";
import { startWakeMonitorScheduler } from "./services/wakeMonitorScheuler.js";
import { startTimetableScheduler } from "./services/timetableScheduler.js";


const port = Number(process.env.PORT ?? 3000);

async function main() {
  try {
    await app.listen({
      port,
      host: "0.0.0.0",
    });

    await startMqtt();



    startWakeMonitorScheduler();
    startTimetableScheduler();
    testWakeMonitor();

    console.log(`API listening on port ${port}`);
  } catch (error) {
    app.log.error(error);
    await stopMqtt();
    process.exit(1);
  }
}

async function shutdown() {
  await app.close();

  await stopMqtt();
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

await main();
