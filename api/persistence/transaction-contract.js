"use strict";

/**
 * Provider-neutral transaction boundary.
 *
 * Domain services receive a transaction callback rather than knowing the
 * underlying database driver's transaction API. The default repository
 * remains non-transactional for development; production adapters must provide
 * real atomic semantics.
 */

function createTransactionBoundary({ begin, commit, rollback }) {
  if (typeof begin !== "function" || typeof commit !== "function" || typeof rollback !== "function") {
    throw new TypeError("begin, commit and rollback functions are required");
  }

  return Object.freeze({
    async run(work) {
      if (typeof work !== "function") throw new TypeError("Transaction work function is required");
      const transaction = await begin();
      try {
        const result = await work(transaction);
        await commit(transaction);
        return result;
      } catch (error) {
        await rollback(transaction);
        throw error;
      }
    }
  });
}

function createUnsupportedTransactionBoundary() {
  return Object.freeze({
    async run() {
      throw new Error("Transactional persistence provider is not configured");
    }
  });
}

module.exports = { createTransactionBoundary, createUnsupportedTransactionBoundary };
