const dotenv = require("dotenv");

// Load environment variables from .env file
dotenv.config();

const config = {
  // Server configuration
  port: process.env.PORT,
  nodeEnv: process.env.NODE_ENV || "development",

  // Database configuration
  db: {
    host: String(process.env.DB_HOST),
    port: Number(process.env.DB_PORT),
    database: String(process.env.DB_NAME),
    user: String(process.env.DB_USER),
    password: String(process.env.DB_PASSWORD),
    ssl: process.env.DB_SSL === "true",
  },

  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || "1d",
  },

  // API configuration
  api: {
    prefix: "/api",
    version: "v1",
  },
};

module.exports = { config };
