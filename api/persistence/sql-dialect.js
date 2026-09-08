"use strict";

/**
 * Provider-neutral SQL execution contract.
 * Adapters normalize their driver's placeholder syntax behind this boundary;
 * migration/domain code must never assume a particular parameter marker.
 */
const DIALECTS = Object.freeze(["postgresql", "mysql", "mariadb", "sqlite"]);

function createSqlDialect({ provider, placeholder = "?" } = {}) {
  if (!DIALECTS.includes(provider)) throw new Error(`Unsupported SQL provider: ${provider}`);
  if (typeof placeholder !== "function") throw new TypeError("SQL placeholder function is required");
  return Object.freeze({
    provider,
    placeholder,
    bind(sql, params = []) {
      if (typeof sql !== "string") throw new TypeError("SQL statement must be a string");
      if (!Array.isArray(params)) throw new TypeError("SQL parameters must be an array");

      let index = 0;
      let state = "code";
      let boundSql = "";

      for (let i = 0; i < sql.length; i += 1) {
        const ch = sql[i];
        const next = sql[i + 1];

        if (state === "code") {
          if (ch === "'" ) { state = "single"; boundSql += ch; continue; }
          if (ch === '"') { state = "double"; boundSql += ch; continue; }
          if (ch === "`") { state = "backtick"; boundSql += ch; continue; }
          if (ch === "-" && next === "-") { state = "line-comment"; boundSql += "--"; i += 1; continue; }
          if (ch === "/" && next === "*") { state = "block-comment"; boundSql += "/*"; i += 1; continue; }
          if (ch === "?") {
            index += 1;
            boundSql += placeholder(index);
            continue;
          }
          boundSql += ch;
          continue;
        }

        boundSql += ch;
        if (state === "single") {
          if (ch === "'" && next === "'") { boundSql += next; i += 1; continue; }
          if (ch === "'" && sql[i - 1] !== "\\") state = "code";
        } else if (state === "double") {
          if (ch === '"' && next === '"') { boundSql += next; i += 1; continue; }
          if (ch === '"' && sql[i - 1] !== "\\") state = "code";
        } else if (state === "backtick") {
          if (ch === "`" && next === "`") { boundSql += next; i += 1; continue; }
          if (ch === "`") state = "code";
        } else if (state === "line-comment" && ch === "\n") {
          state = "code";
        } else if (state === "block-comment" && ch === "*" && next === "/") {
          boundSql += next;
          i += 1;
          state = "code";
        }
      }

      if (index !== params.length) {
        throw new Error(`SQL placeholder count (${index}) does not match parameter count (${params.length})`);
      }
      return { sql: boundSql, params };
    }
  });
}

module.exports = { DIALECTS, createSqlDialect };
