"use strict";

function createLegalVersionService({ repository, clock = () => new Date() } = {}) {
  if (!repository?.create) throw new Error("Legal version repository is not configured");

  return {
    async create({ legalInstrumentId, jurisdiction, title, validFrom, validTo = null, amendmentState = "in_force", sourceId, actor }) {
      if (!actor?.id) throw new Error("Authenticated actor is required");
      if (!legalInstrumentId || !jurisdiction || !title || !validFrom || !sourceId) throw new Error("Legal version requires instrument, jurisdiction, title, validFrom and source");
      return repository.create({ legalInstrumentId, jurisdiction, title, validFrom, validTo, amendmentState, sourceId, createdBy: actor.id, createdAt: clock().toISOString() });
    },
    async effectiveAt({ legalInstrumentId, jurisdiction, date }) {
      if (!legalInstrumentId || !jurisdiction || !date) throw new Error("Instrument, jurisdiction and date are required");
      const records = await repository.list();
      return records
        .filter((item) => item.legalInstrumentId === legalInstrumentId && item.jurisdiction === jurisdiction && item.validFrom <= date && (!item.validTo || date <= item.validTo))
        .sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0] || null;
    }
  };
}

module.exports = { createLegalVersionService };
