const { Pool } = require("pg");
const { config } = require("../config");

class Database {
  constructor() {
    this.pool = new Pool(config.db);
  }

  async connect() {
    try {
      const client = await this.pool.connect();
      client.release();
      return true;
    } catch (error) {
      console.error("Database connection error:", error);
      throw error;
    }
  }

  async query(text, params) {
    try {
      const result = await this.pool.query(text, params);
      return result;
    } catch (error) {
      console.error("Database query error:", error);
      throw error;
    }
  }

  async transaction(callback) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = new Database();