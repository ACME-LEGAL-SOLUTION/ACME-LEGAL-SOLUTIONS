"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

function postgresClient({ config }) {
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: config.connectionUrl, ssl: config.sslRequired ? { rejectUnauthorized: false } : undefined });
  return { connect: () => pool.connect(), close: () => pool.end(), query: (sql, params) => pool.query(sql, params) };
}

function mysqlClient({ config }) {
  const mysql = require("mysql2/promise");
  let pool;
  const createPool = () => mysql.createPool({ uri: config.connectionUrl, ssl: config.sslRequired ? { rejectUnauthorized: false } : undefined, waitForConnections: true, multipleStatements: true });
  return {
    async connect() {
      if (!pool) pool = createPool();
      return pool.getConnection();
    },
    async close() { if (pool) await pool.end(); pool = null; },
    async query(sql, params) {
      if (!pool) pool = createPool();
      const [rows] = await pool.query(sql, params);
      return { rows: Array.isArray(rows) ? rows : [] };
    }
  };
}

function mariadbClient({ config }) {
  const mariadb = require("mariadb");
  const url = new URL(config.connectionUrl);
  const pool = mariadb.createPool({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    ssl: config.sslRequired ? { rejectUnauthorized: false } : undefined,
    connectionLimit: 5,
    multipleStatements: true
  });
  return {
    connect: () => pool.getConnection(),
    close: () => pool.end(),
    async query(sql, params) {
      const connection = await pool.getConnection();
      try {
        const rows = await connection.query(sql, params);
        return { rows: Array.isArray(rows) ? rows : [] };
      } finally { connection.release(); }
    }
  };
}

function sqliteClient({ config }) {
  const sqlite3 = require("sqlite3");
  const filePath = new URL(config.connectionUrl).pathname;
  const database = new sqlite3.Database(filePath);
  const exec = (sql) => new Promise((resolve, reject) => database.exec(sql, (error) => error ? reject(error) : resolve({ rows: [] })));
  const run = (sql, params = []) => new Promise((resolve, reject) => database.run(sql, params, (error) => error ? reject(error) : resolve({ rows: [] })));
  const all = (sql, params = []) => new Promise((resolve, reject) => database.all(sql, params, (error, rows) => error ? reject(error) : resolve({ rows })));
  const query = (sql, params = []) => {
    if (params.length === 0 && /;/.test(sql.trim().replace(/;\s*$/, ""))) return exec(sql);
    return /^SELECT\b/i.test(sql.trim()) ? all(sql, params) : run(sql, params);
  };
  return { connect: async () => ({ query, close: async () => {} }), close: () => new Promise((resolve, reject) => database.close((error) => error ? reject(error) : resolve())), query };
}

async function createSqliteLock({ config }) {
  const lockPath = path.resolve(new URL(config.connectionUrl).pathname + ".migration.lock");
  let handle = null;
  return {
    get held() { return handle !== null; },
    async acquire() {
      if (handle) throw new Error("Migration lock already held");
      try { handle = await fs.open(lockPath, "wx"); }
      catch (error) { throw new Error(`Unable to acquire sqlite migration lock: ${error.message}`); }
    },
    async release() {
      if (!handle) return;
      await handle.close(); handle = null; await fs.rm(lockPath, { force: true });
    }
  };
}

module.exports = {
  postgresql: postgresClient,
  mysql: mysqlClient,
  mariadb: mariadbClient,
  sqlite: sqliteClient,
  createClient: ({ config }) => {
    const factory = module.exports[config.provider];
    if (!factory) throw new Error(`Unsupported CI database provider: ${config.provider}`);
    return factory({ config });
  },
  createSqliteLock
};
