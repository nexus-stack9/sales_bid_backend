const dotenv = require("dotenv");

// Load environment variables from .env file
dotenv.config();

const config = {
  // Server configuration
  port: process.env.PORT,
  nodeEnv: process.env.NODE_ENV || "development",

  // Database configuration
  db: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
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