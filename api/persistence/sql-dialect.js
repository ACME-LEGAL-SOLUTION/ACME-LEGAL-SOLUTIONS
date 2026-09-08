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
      if (!Array.isArray(params)) throw new TypeError("SQL parameters must be an array");
      return { sql, params };
    }
  });
}

module.exports = { DIALECTS, createSqlDialect };
