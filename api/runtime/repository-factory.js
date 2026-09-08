"use strict";

const { createCollection } = require("./in-memory-repository");

const COLLECTIONS = Object.freeze([
  "clients", "relationships", "parties", "conflicts", "documents", "evidence",
  "aiInteractions", "reviews", "audit", "sources", "legalVersions", "authorities",
  "diary", "hearings", "invoices", "payments", "partners"
]);

function createApplicationRepositories() {
  const repositories = Object.fromEntries(COLLECTIONS.map((name) => [name, createCollection()]));
  repositories.auditService = {
    append: async (event) => repositories.audit.create(event),
    list: async () => repositories.audit.list()
  };
  repositories.matters = {
    ...createCollection()
  };
  return repositories;
}

module.exports = { COLLECTIONS, createApplicationRepositories };
