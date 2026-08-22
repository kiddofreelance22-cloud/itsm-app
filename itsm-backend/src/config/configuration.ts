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

  mail: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true", // true for port 465, false for 587/25
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD || process.env.SMTP_PASS,
    fromName: process.env.SMTP_FROM_NAME || "ITSM Support",
    fromAddress: process.env.SMTP_FROM_ADDRESS || process.env.SMTP_USER,
  },
});
