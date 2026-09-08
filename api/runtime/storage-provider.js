"use strict";

const { createApplicationRepositories } = require("./repository-factory");
const { createRepositoryAdapter } = require("./persistence-contract");

/**
 * Storage selection remains explicit. Until a production database is selected
 * and configured, ACME defaults to the in-memory adapter and never pretends
 * that ephemeral storage is production persistence.
 */
function createStorageProvider({ repositories } = {}) {
  const resolved = repositories || createApplicationRepositories();
  return createRepositoryAdapter({ repositories: resolved });
}

module.exports = { createStorageProvider };
