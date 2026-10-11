import mqtt, { type MqttClient } from "mqtt";

let client: MqttClient;

export function startMqtt(): Promise<void> {
  const url = process.env.MQTT_URL;
  const username = process.env.MQTT_USERNAME;
  const password = process.env.MQTT_PASSWORD;

  if (!url || !username || !password) {
    throw new Error("Missing MQTT environment variables");
  }

  client = mqtt.connect(url, {
    username,
    password,
    reconnectPeriod: 1000,
  });

  return new Promise((resolve, reject) => {
    client.once("connect", () => {
      console.log("[MQTT] Connected");
      resolve();
    });

    client.once("error", reject);
  });
}

export function publish(
  topic: string,
  message: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!client?.connected) {
      reject(new Error("MQTT is not connected"));
      return;
    }

    client.publish(topic, message, { qos: 1 }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

export function subscribe(
  topic: string,
  handler: (topic: string, message: string) => void,
): void {
  if (!client) {
    throw new Error("MQTT has not been started");
  }

  client.subscribe(topic, { qos: 1 }, (error) => {
    if (error) {
      console.error("[MQTT] Subscribe failed:", error.message);
    }
  });

  client.on("message", (receivedTopic, payload) => {
    if (matchesTopic(topic, receivedTopic)) {
      handler(receivedTopic, payload.toString());
    }
  });
}

function matchesTopic(filter: string, topic: string): boolean {
  const filterParts = filter.split("/");
  const topicParts = topic.split("/");

  let i = 0;

  for (; i < filterParts.length; i++) {
    if (filterParts[i] === "#") return true;

    if (i >= topicParts.length) return false;

    if (filterParts[i] !== "+" && filterParts[i] !== topicParts[i]) {
      return false;
    }
  }

  return i === topicParts.length;
}

export function stopMqtt(): Promise<void> {
  if (!client) return Promise.resolve();

  return new Promise((resolve) => {
    client.end(false, {}, resolve);
  });
}