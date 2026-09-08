"use strict";

const { createStorageProvider } = require("../runtime/storage-provider");
const { createUnsupportedTransactionBoundary } = require("./transaction-contract");

/**
 * Composes persistence and transactions without binding ACME services to a
 * database driver. A production adapter supplies `transaction` explicitly.
 */
function createTransactionalStorage({ repositories, transaction } = {}) {
  const storage = createStorageProvider({ repositories });
  const transactionBoundary = transaction || createUnsupportedTransactionBoundary();

  return Object.freeze({
    ...storage,
    transaction: transactionBoundary,
    assertProductionReady() {
      if (!transaction) throw new Error("Transactional persistence provider is not configured");
      storage.assert();
      return true;
    }
  });
}

module.exports = { createTransactionalStorage };
