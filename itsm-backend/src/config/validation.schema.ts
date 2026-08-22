import * as Joi from "joi";

/**
 * Fails fast on app boot if required env vars are missing/malformed, instead of
 * surfacing a confusing error later (e.g. mid-request when SMTP is first used).
 * Register in app.module.ts: ConfigModule.forRoot({ validationSchema })
 * Requires: npm install joi
 */
export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid("development", "test", "production")
    .default("development"),
  PORT: Joi.number().default(4000),

  DB_HOST: Joi.string().optional(),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().optional(),
  DB_PASSWORD: Joi.string().optional(),
  DB_NAME: Joi.string().optional(),

  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string().default("1d"),

  // SMTP / mail
  SMTP_HOST: Joi.string().optional(),
  SMTP_PORT: Joi.number().default(587),
  SMTP_SECURE: Joi.boolean().default(false),
  SMTP_USER: Joi.string().optional(),
  SMTP_PASSWORD: Joi.string().optional(),
  SMTP_PASS: Joi.string().optional(),
  SMTP_FROM_NAME: Joi.string().default("ITSM Support"),
  SMTP_FROM_ADDRESS: Joi.string().email().optional(),
});
