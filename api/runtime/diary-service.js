"use strict";

const STATUSES = Object.freeze(["scheduled", "completed", "adjourned", "cancelled"]);

function createDiaryService({ repository, audit = null, clock = () => new Date() } = {}) {
  if (!repository?.create) throw new Error("Diary repository is not configured");
  async function auditEvent(type, payload, actor) {
    if (audit?.append) await audit.append({ type, actorId: actor.id, payload, occurredAt: clock().toISOString() });
  }
  return {
    async schedule({ matterId, authorityId, hearingAt, title, actor }) {
      if (!matterId || !authorityId || !hearingAt || !title) throw new Error("Matter, authority, hearing time and title are required");
      if (!actor?.id) throw new Error("Authenticated actor is required");
      const item = await repository.create({ matterId, authorityId, hearingAt, title, status: "scheduled", createdBy: actor.id, createdAt: clock().toISOString() });
      await auditEvent("diary.scheduled", item, actor);
      return item;
    },
    async updateStatus(item, status, actor, note = null) {
      if (!item?.id) throw new Error("Diary item is required");
      if (!actor?.id) throw new Error("Authenticated actor is required");
      if (!STATUSES.includes(status)) throw new Error(`Invalid diary status: ${status}`);
      const updated = await repository.update(item.id, { status, note, updatedBy: actor.id, updatedAt: clock().toISOString() });
      await auditEvent("diary.status_changed", updated, actor);
      return updated;
    },
    async listMatter(matterId) {
      if (!matterId) throw new Error("Matter is required");
      return (await repository.list()).filter((item) => item.matterId === matterId).sort((a, b) => a.hearingAt.localeCompare(b.hearingAt));
    },
    STATUSES
  };
}

module.exports = { STATUSES, createDiaryService };
