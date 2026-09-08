"use strict";

const { createApplicationRuntime } = require("../runtime/application-runtime");
const { createSqlRepositories } = require("./sql-repository-adapter");
const { createTransactionalStorage } = require("./transactional-storage");
const { createTransactionBoundary } = require("./transaction-contract");
const { createTransactionalOperations } = require("./transactional-operations");
const { createMatterAuthorization, createMatterScopedOperations } = require("../security/matter-authorization");

/**
 * Production composition seam: application services receive the SQL-backed
 * provider-neutral repositories while the SQL driver remains injected.
 */
function createPersistentApplication({ executor, begin, commit, rollback, provider, clock, resolveMatterAccess } = {}) {
  const { repositories } = createSqlRepositories({ executor });
  const transaction = createTransactionBoundary({ begin, commit, rollback });
  const storage = createTransactionalStorage({ repositories, transaction });
  const operations = createTransactionalOperations({ transaction, repositories });
  const application = createApplicationRuntime({ repositories, provider, clock });
  const authorization = resolveMatterAccess ? createMatterAuthorization({ resolveAccess: resolveMatterAccess }) : null;
  const matterOperations = authorization ? createMatterScopedOperations({ authorization, transaction }) : null;

  return Object.freeze({ application, repositories, storage, transaction, operations, authorization, matterOperations });
}

module.exports = { createPersistentApplication };
