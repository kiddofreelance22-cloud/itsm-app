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

  OPENAI_API_KEY: Joi.string().allow("").optional(),
  OPENAI_BASE_URL: Joi.string().uri({ scheme: ["http", "https"] }).optional(),
  CHAT_MODEL: Joi.string().trim().min(1).default("qwen2.5:3b"),
  CHAT_TIMEOUT_MS: Joi.number().integer().min(1000).max(600000).default(90000),
  CHAT_KNOWLEDGE_DIR: Joi.string().optional(),

  SSO_FRONTEND_URL: Joi.string().uri({ scheme: ["http", "https"] }).optional(),
  SSO_BACKEND_URL: Joi.string().uri({ scheme: ["http", "https"] }).optional(),
  GOOGLE_CLIENT_ID: Joi.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: Joi.string().min(1).optional(),
  MICROSOFT_CLIENT_ID: Joi.string().min(1).optional(),
  MICROSOFT_CLIENT_SECRET: Joi.string().min(1).optional(),
  MICROSOFT_TENANT_ID: Joi.string().guid().optional(),
  SSO_ALLOWED_DOMAINS: Joi.string().allow("").optional(),
  SSO_AUTO_PROVISION: Joi.boolean().default(false),
  SSO_DEFAULT_ROLE_ID: Joi.number().integer().positive().optional(),
}).custom((values, helpers) => {
  const googleValues = [values.GOOGLE_CLIENT_ID, values.GOOGLE_CLIENT_SECRET];
  const microsoftValues = [
    values.MICROSOFT_CLIENT_ID,
    values.MICROSOFT_CLIENT_SECRET,
    values.MICROSOFT_TENANT_ID,
  ];
  const googleConfigured = googleValues.every(Boolean);
  const microsoftConfigured = microsoftValues.every(Boolean);
  const googlePartial = googleValues.some(Boolean) && !googleConfigured;
  const microsoftPartial = microsoftValues.some(Boolean) && !microsoftConfigured;

  if (googlePartial) {
    return helpers.error("any.custom", {
      message: "Google SSO requires both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
    });
  }
  if (microsoftPartial) {
    return helpers.error("any.custom", {
      message:
        "Microsoft SSO requires MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, and MICROSOFT_TENANT_ID.",
    });
  }
  if (Boolean(values.SSO_FRONTEND_URL) !== Boolean(values.SSO_BACKEND_URL)) {
    return helpers.error("any.custom", {
      message: "SSO_FRONTEND_URL and SSO_BACKEND_URL must be set together.",
    });
  }
  if ((googleConfigured || microsoftConfigured) && !values.SSO_FRONTEND_URL) {
    return helpers.error("any.custom", {
      message:
        "SSO_FRONTEND_URL and SSO_BACKEND_URL are required when an SSO provider is configured.",
    });
  }
  if (values.SSO_AUTO_PROVISION && !values.SSO_DEFAULT_ROLE_ID) {
    return helpers.error("any.custom", {
      message: "SSO_DEFAULT_ROLE_ID is required when SSO_AUTO_PROVISION=true.",
    });
  }
  return values;
}).messages({
  "any.custom": "{{#message}}",
});
