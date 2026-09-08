"use strict";

const { createApplicationRuntime } = require("../runtime/application-runtime");
const { createSqlRepositories } = require("./sql-repository-adapter");
const { createTransactionalStorage } = require("./transactional-storage");
const { createTransactionBoundary } = require("./transaction-contract");

/**
 * Production composition seam: application services receive the SQL-backed
 * provider-neutral repositories while the SQL driver remains injected.
 */
function createPersistentApplication({ executor, begin, commit, rollback, provider, clock } = {}) {
  const { repositories } = createSqlRepositories({ executor });
  const transaction = createTransactionBoundary({ begin, commit, rollback });
  const storage = createTransactionalStorage({ repositories, transaction });
  const application = createApplicationRuntime({ repositories, provider, clock });

  return Object.freeze({ application, repositories: storage, transaction });
}

module.exports = { createPersistentApplication };
