const { Client } = require("pg");
require("dotenv").config();
const { databaseLogger } = require("../utils/logger/index");

async function createDatabaseAndTables() {
  const dbName = "dams"; // ✅ force DB name

  let adminConn;
  try {
    // Connect to default "postgres" database (to manage db creation)
    adminConn = new Client({
      host: process.env.PG_HOST || "localhost",
      user: process.env.PG_USER || "postgres",
      password: process.env.PG_PASSWORD || "root",
      port: process.env.PG_PORT || 5432,
      database: "postgres",
    });
    await adminConn.connect();

    // Terminate connections to drop database cleanly
    await adminConn.query(
      `SELECT pg_terminate_backend(pg_stat_activity.pid)
       FROM pg_stat_activity
       WHERE pg_stat_activity.datname = $1
       AND pid <> pg_backend_pid();`,
      [dbName]
    );

    // Drop and recreate DB
    await adminConn.query(`DROP DATABASE IF EXISTS ${dbName}`);
    await adminConn.query(`CREATE DATABASE ${dbName}`);
    databaseLogger.info(`Database "${dbName}" created successfully`);

    await adminConn.end();

    // Connect to the new DB
    const conn = new Client({
      host: process.env.PG_HOST || "localhost",
      user: process.env.PG_USER || "postgres",
      password: process.env.PG_PASSWORD || "root",
      port: process.env.PG_PORT || 5432,
      database: dbName,
    });
    await conn.connect();

    // --- Create ENUM Type ---
    await conn.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
          CREATE TYPE user_role AS ENUM ('admin', 'user', 'viewer');
        END IF;
      END$$;
    `);
    databaseLogger.info("✅ ENUM type 'user_role' ensured.");

    // --- Users Table ---
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(250),
        email VARCHAR(150) UNIQUE NOT NULL,
        password VARCHAR(255) DEFAULT NULL,
        google_id VARCHAR(255) UNIQUE,
        role user_role NOT NULL DEFAULT 'user',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // --- Assets Table ---
    await conn.query(`
      CREATE TABLE IF NOT EXISTS assets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        filename VARCHAR(255) NOT NULL,
        file_url TEXT NOT NULL,
        mime_type VARCHAR(100),
        size BIGINT,
        tags TEXT[],
        permissions JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // --- Shared Assets Table ---
    await conn.query(`
      CREATE TABLE IF NOT EXISTS shared_assets (
        id SERIAL PRIMARY KEY,
        asset_id INTEGER REFERENCES assets(id) ON DELETE CASCADE,
        shared_with INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // --- Activity Logs Table ---
    await conn.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(50),
        asset_id INTEGER REFERENCES assets(id) ON DELETE SET NULL,
        status VARCHAR(50),
        message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    databaseLogger.info("✅ All tables created successfully in new DB", { database: dbName });

    await conn.end();
  } catch (err) {
    databaseLogger.error("Error creating database/tables", {
      error: err.message,
      stack: err.stack,
    });
  }
}

createDatabaseAndTables();