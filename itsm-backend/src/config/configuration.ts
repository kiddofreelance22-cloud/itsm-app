/**
 * Central, typed access point for all env vars. Register in app.module.ts via:
 * ConfigModule.forRoot({ isGlobal: true, load: [configuration], validationSchema })
 * Then inject ConfigService and call config.get('database.host') etc.
 */
export default () => ({
  env: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "4000", 10),

  database: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "5432", 10),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    name: process.env.DB_NAME,
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || "1d",
  },

  sso: {
    frontendUrl: process.env.SSO_FRONTEND_URL,
    backendUrl: process.env.SSO_BACKEND_URL,
    allowedDomains: process.env.SSO_ALLOWED_DOMAINS || "",
    autoProvision: process.env.SSO_AUTO_PROVISION === "true",
    defaultRoleId: process.env.SSO_DEFAULT_ROLE_ID
      ? parseInt(process.env.SSO_DEFAULT_ROLE_ID, 10)
      : undefined,
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      tenantId: process.env.MICROSOFT_TENANT_ID,
    },
  },

  mail: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true", // true for port 465, false for 587/25
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD || process.env.SMTP_PASS,
    fromName: process.env.SMTP_FROM_NAME || "ITSM Support",
    fromAddress: process.env.SMTP_FROM_ADDRESS || process.env.SMTP_USER,
  },

  chat: {
    apiKey: process.env.OPENAI_API_KEY || "",
    baseUrl: process.env.OPENAI_BASE_URL || "http://127.0.0.1:11434/v1",
    model: process.env.CHAT_MODEL || "qwen2.5:3b",
    timeoutMs: parseInt(process.env.CHAT_TIMEOUT_MS || "90000", 10),
    knowledgeDir: process.env.CHAT_KNOWLEDGE_DIR || "./knowledge",
  },
});
