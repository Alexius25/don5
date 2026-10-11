import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  MQTT_URL: z.string().min(1),
  MQTT_USERNAME: z.string().min(1),
  MQTT_PASSWORD: z.string().min(1),

  WEBUNTIS_USERNAME_JONATHAN: z.string().min(1),
  WEBUNTIS_PASSWORD_JONATHAN: z.string().min(1),
  WEBUNTIS_SCHOOL_JONATHAN: z.string().min(1),
  WEBUNTIS_BASE_URL_JONATHAN: z.string().min(1),

  WEBUNTIS_USERNAME_ALEX: z.string().min(1),
  WEBUNTIS_PASSWORD_ALEX: z.string().min(1),
  WEBUNTIS_SCHOOL_ALEX: z.string().min(1),
  WEBUNTIS_BASE_URL_ALEX: z.string().min(1),
});

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;
