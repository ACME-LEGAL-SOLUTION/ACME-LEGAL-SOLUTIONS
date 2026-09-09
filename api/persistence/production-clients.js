"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

function connectionOptions(config) {
  const url = new URL(config.connectionUrl);
  const options = {
    host: url.hostname,
    port: url.port ? Number(url.port) : undefined,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, "") || undefined
  };
  if (config.sslRequired) options.ssl = { rejectUnauthorized: false };
  return options;
}

function postgresql({ config }) {
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: config.connectionUrl, ssl: config.sslRequired ? { rejectUnauthorized: false } : undefined });
  return { connect: () => pool.connect(), close: () => pool.end(), query: (sql, params) => pool.query(sql, params) };
}

function mysql({ config }) {
  const mysql = require("mysql2/promise");
  let pool;
  const createPool = () => mysql.createPool({ ...connectionOptions(config), waitForConnections: true, multipleStatements: true });
  return {
    async connect() { if (!pool) pool = createPool(); return pool.getConnection(); },
    async close() { if (pool) await pool.end(); pool = null; },
    async query(sql, params) { if (!pool) pool = createPool(); const [rows] = await pool.query(sql, params); return { rows: Array.isArray(rows) ? rows : [] }; }
  };
}

function mariadb({ config }) {
  const mariadb = require("mariadb");
  const pool = mariadb.createPool({ ...connectionOptions(config), connectionLimit: 5, multipleStatements: true });
  return {
    connect: () => pool.getConnection(),
    close: () => pool.end(),
    async query(sql, params) { const connection = await pool.getConnection(); try { const rows = await connection.query(sql, params); return { rows: Array.isArray(rows) ? rows : [] }; } finally { connection.release(); } }
  };
}

function sqlite({ config }) {
  const sqlite3 = require("sqlite3");
  const filePath = path.resolve(new URL(config.connectionUrl).pathname);
  const database = new sqlite3.Database(filePath);
  const run = (sql, params = []) => new Promise((resolve, reject) => database.run(sql, params, function (error) { error ? reject(error) : resolve({ rows: [], affectedRows: this.changes, rowCount: this.changes }); }));
  const all = (sql, params = []) => new Promise((resolve, reject) => database.all(sql, params, (error, rows) => error ? reject(error) : resolve({ rows })));
  const exec = (sql) => new Promise((resolve, reject) => database.exec(sql, (error) => error ? reject(error) : resolve({ rows: [] })));
  const query = (sql, params = []) => /^SELECT\b/i.test(sql.trim()) ? all(sql, params) : (params.length ? run(sql, params) : exec(sql));
  return { connect: async () => ({ query, close: async () => {} }), close: () => new Promise((resolve, reject) => database.close((error) => error ? reject(error) : resolve())), query };
}

async function createSqliteLock({ config }) {
  const lockPath = path.resolve(new URL(config.connectionUrl).pathname + ".migration.lock");
  let handle = null;
  return {
    get held() { return handle !== null; },
    async acquire() { if (handle) throw new Error("Migration lock already held"); try { handle = await fs.open(lockPath, "wx"); } catch (error) { throw new Error(`Unable to acquire sqlite migration lock: ${error.message}`); } },
    async release() { if (!handle) return; await handle.close(); handle = null; await fs.rm(lockPath, { force: true }); }
  };
}

module.exports = { postgresql, mysql, mariadb, sqlite, createSqliteLock };
