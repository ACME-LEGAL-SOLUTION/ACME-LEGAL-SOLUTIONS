"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createSqlDialect } = require("./sql-dialect");

test("SQL dialect exposes provider and binding contract", () => {
  const dialect = createSqlDialect({ provider: "postgresql", placeholder: (index) => `$${index}` });
  assert.equal(dialect.provider, "postgresql");
  assert.deepEqual(dialect.bind("INSERT INTO t VALUES ($1)", ["x"]), {
    sql: "INSERT INTO t VALUES ($1)", params: ["x"]
  });
});

test("SQL dialect rejects unsupported providers", () => {
  assert.throws(() => createSqlDialect({ provider: "oracle", placeholder: () => "?" }), /Unsupported SQL provider/);
});

test("SQL dialect requires a placeholder function", () => {
  assert.throws(() => createSqlDialect({ provider: "sqlite" }), /placeholder function/);
});
