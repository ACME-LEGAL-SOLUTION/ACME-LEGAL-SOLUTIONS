"use strict";

const { createApplicationRuntime } = require("../runtime/application-runtime");
const { createSqlRepositories } = require("./sql-repository-adapter");
const { createTransactionalStorage } = require("./transactional-storage");
const { createTransactionBoundary } = require("./transaction-contract");
const { createTransactionalOperations } = require("./transactional-operations");
const { createPersistentCrmOperations } = require("./persistent-crm-operations");
const { createMatterAuthorization, createMatterScopedOperations } = require("../security/matter-authorization");

/**
 * Production composition seam: application services receive provider-neutral
 * repositories while SQL and transactions remain injected.
 */
function createPersistentApplication({ executor, begin, commit, rollback, provider, clock, resolveMatterAccess } = {}) {
  const { repositories } = createSqlRepositories({ executor });
  const transaction = createTransactionBoundary({ begin, commit, rollback });
  const storage = createTransactionalStorage({ repositories, transaction });
  const scopedRepositoryFactory = (tx) => tx && typeof tx.query === "function"
    ? createSqlRepositories({ executor: tx }).repositories
    : repositories;

  const operations = createTransactionalOperations({
    transaction,
    repositories,
    repositoryFactory: scopedRepositoryFactory
  });
  const authorization = resolveMatterAccess
    ? createMatterAuthorization({ resolveAccess: resolveMatterAccess })
    : null;
  const matterOperations = authorization
    ? createMatterScopedOperations({ authorization, transaction, repositoryFactory: scopedRepositoryFactory })
    : null;
  const crmOperations = createPersistentCrmOperations({
    transaction,
    repositories,
    repositoryFactory: scopedRepositoryFactory,
    matterAuthorization: authorization,
    clock
  });
  const application = createApplicationRuntime({ repositories, provider, clock });

  return Object.freeze({
    application,
    repositories,
    storage,
    transaction,
    operations,
    crmOperations,
    authorization,
    matterOperations
  });
}

module.exports = { createPersistentApplication };
