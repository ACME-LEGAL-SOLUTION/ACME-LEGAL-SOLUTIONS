"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createSqlDialect } = require("./sql-dialect");

test("SQL dialect normalizes provider placeholder syntax", () => {
  const dialect = createSqlDialect({ provider: "postgresql", placeholder: (index) => `$${index}` });
  assert.equal(dialect.provider, "postgresql");
  assert.deepEqual(dialect.bind("INSERT INTO t VALUES (?, ?)", ["x", "y"]), {
    sql: "INSERT INTO t VALUES ($1, $2)", params: ["x", "y"]
  });
});

test("SQL dialect preserves question-mark syntax for SQLite-style drivers", () => {
  const dialect = createSqlDialect({ provider: "sqlite", placeholder: () => "?" });
  assert.deepEqual(dialect.bind("INSERT INTO t VALUES (?, ?)", ["x", "y"]), {
    sql: "INSERT INTO t VALUES (?, ?)", params: ["x", "y"]
  });
});

test("SQL dialect rejects placeholder/parameter count mismatch", () => {
  const dialect = createSqlDialect({ provider: "postgresql", placeholder: (index) => `$${index}` });
  assert.throws(() => dialect.bind("SELECT ?", []), /placeholder count/);
  assert.throws(() => dialect.bind("SELECT 1", ["x"]), /placeholder count/);
});

test("SQL dialect rejects unsupported providers", () => {
  assert.throws(() => createSqlDialect({ provider: "oracle", placeholder: () => "?" }), /Unsupported SQL provider/);
});

test("SQL dialect requires a placeholder function", () => {
  assert.throws(() => createSqlDialect({ provider: "sqlite" }), /placeholder function/);
});
