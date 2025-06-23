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
  // R2 Storage configuration
  r2: {
    accessKeyId: "07b7dc2e3ebb4e5fc720a6cd927f6b28",
    secretAccessKey: "915b24dc64681d7baae3ebc1241d9862841e905ef72463081384f73280f5adaf",
    endpoint: "https://8b22bbe360edacd5c4351c60c8c04b39.r2.cloudflarestorage.com",
    bucket: "salesbid",
    // - R2_ACCESS_KEY_ID=07b7dc2e3ebb4e5fc720a6cd927f6b28
    //   - R2_SECRET_ACCESS_KEY=915b24dc64681d7baae3ebc1241d9862841e905ef72463081384f73280f5adaf
    //   - R2_ENDPOINT=https://8b22bbe360edacd5c4351c60c8c04b39.r2.cloudflarestorage.com
    //   - R2_BUCKET=salesbid
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
