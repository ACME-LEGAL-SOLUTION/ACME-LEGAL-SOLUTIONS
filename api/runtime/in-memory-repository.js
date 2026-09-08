"use strict";

const { randomUUID } = require("node:crypto");

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function createCollection() {
  const records = new Map();

  return {
    async create(input) {
      const record = { ...input, id: input?.id || randomUUID() };
      if (records.has(record.id)) {
        throw new Error(`Record already exists: ${record.id}`);
      }
      records.set(record.id, clone(record));
      return clone(record);
    },

    async getById(id) {
      return clone(records.get(id) || null);
    },

    async list() {
      return [...records.values()].map(clone);
    },

    async update(id, patch) {
      const current = records.get(id);
      if (!current) throw new Error(`Record not found: ${id}`);
      const updated = { ...current, ...patch, id };
      records.set(id, clone(updated));
      return clone(updated);
    }
  };
}

function createRepositories({ clock = () => new Date() } = {}) {
  const matters = createCollection();
  const clients = createCollection();
  const relationships = createCollection();

  return {
    clients,
    relationships,
    matters: {
      ...matters,
      async transition(id, status, actor, review = null) {
        return matters.update(id, {
          status,
          updatedAt: clock().toISOString(),
          lastTransitionBy: actor.id,
          lastReviewId: review?.id || null
        });
      }
    }
  };
}

module.exports = { createCollection, createRepositories };
