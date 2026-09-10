"use strict";

/**
 * Provider-neutral persistence contract.
 *
 * Domain services depend only on these collection capabilities. Production
 * adapters may back them with PostgreSQL, another approved relational store,
 * or a controlled provider without changing the service layer.
 */
const COLLECTIONS = Object.freeze([
  "clients", "matters", "relationships", "parties", "conflicts", "documents", "evidence",
  "aiInteractions", "reviews", "audit", "sources", "legalVersions", "authorities",
  "diary", "hearings", "invoices", "payments", "partners", "workPackages"
]);

const METHODS = Object.freeze(["create", "getById", "list", "update"]);

function assertRepositoryContract(repositories) {
  if (!repositories || typeof repositories !== "object") throw new TypeError("Repositories are required");
  for (const name of COLLECTIONS) {
    const repository = repositories[name];
    if (!repository) throw new Error(`Repository is missing: ${name}`);
    for (const method of METHODS) {
      if (typeof repository[method] !== "function") throw new Error(`Repository ${name}.${method} is required`);
    }
  }
  if (typeof repositories.matters.transition !== "function") throw new Error("Repository matters.transition is required");
  if (typeof repositories.auditService?.append !== "function") throw new Error("Repository auditService.append is required");
  return true;
}

function createRepositoryAdapter({ repositories }) {
  assertRepositoryContract(repositories);
  return Object.freeze({ repositories, assert: () => assertRepositoryContract(repositories) });
}

module.exports = { COLLECTIONS, METHODS, assertRepositoryContract, createRepositoryAdapter };
