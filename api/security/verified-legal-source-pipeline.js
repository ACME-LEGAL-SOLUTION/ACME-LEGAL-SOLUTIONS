"use strict";

const crypto = require("node:crypto");

const VERIFIED_STATES = Object.freeze(["unverified", "verified", "stale", "rejected"]);
const AMENDMENT_STATES = Object.freeze(["in_force", "amended", "repealed", "superseded", "proposed"]);

function createVerifiedLegalSourcePipeline({ sources, legalVersions, audit = null, clock = () => new Date(), acquisition = null } = {}) {
  if (!sources?.create || !sources?.getById || !sources?.update) throw new Error("Source repository is required");
  if (!legalVersions?.create || !legalVersions?.list) throw new Error("Legal version repository is required");
  if (acquisition !== null && typeof acquisition.fetch !== "function") throw new TypeError("Legal source acquisition adapter must implement fetch");

  async function acquire({ jurisdiction, locator, sourceType = "primary_authority", title, issuingAuthority = null, effectiveDate = null, actor }) {
    requireActor(actor); requireValue(jurisdiction, "Jurisdiction"); requireValue(locator, "Source locator"); requireValue(title, "Source title");
    if (!acquisition) throw new Error("Legal source acquisition adapter is required");
    const fetched = await acquisition.fetch({ jurisdiction, locator });
    if (!fetched?.body) throw new Error("Legal source acquisition returned no body");
    const checksum = fetched.checksum || sha256(fetched.body);
    const source = await sources.create({ id: crypto.randomUUID(), title, sourceType, jurisdiction, issuingAuthority, effectiveDate, verificationState: "unverified", locator, checksum, license: fetched.license || null, fetchedAt: clock().toISOString(), registeredBy: actor.id, createdAt: clock().toISOString() });
    await auditEvent("legal_source.acquired", source, actor, { checksum, locator });
    return source;
  }

  async function verify({ sourceId, actor, verificationState = "verified", verificationEvidence = null }) {
    requireActor(actor); if (!VERIFIED_STATES.includes(verificationState)) throw new Error(`Invalid verification state: ${verificationState}`);
    const source = await sources.getById(sourceId); if (!source) throw new Error("Source was not found");
    if (verificationState === "verified" && !source.checksum) throw new Error("Verified source requires checksum");
    return sources.update(source.id, { verificationState, verifiedBy: actor.id, verifiedAt: clock().toISOString(), verificationEvidence: verificationEvidence || null });
  }

  async function publishVersion({ legalInstrumentId, jurisdiction, title, validFrom, validTo = null, amendmentState = "in_force", sourceId, actor }) {
    requireActor(actor); if (actor.human !== true) throw new Error("Human verifier is required");
    if (!AMENDMENT_STATES.includes(amendmentState)) throw new Error(`Invalid amendment state: ${amendmentState}`);
    const source = await sources.getById(sourceId); if (!source) throw new Error("Source was not found");
    if (source.verificationState !== "verified") throw new Error("Only verified sources may publish legal versions");
    const version = await legalVersions.create({ legalInstrumentId, jurisdiction, title, validFrom, validTo, amendmentState, sourceId, createdBy: actor.id, createdAt: clock().toISOString() });
    await auditEvent("legal_version.published", version, actor, { sourceId });
    return version;
  }

  async function reconcile({ legalInstrumentId, jurisdiction, actor }) {
    requireActor(actor); const versions = (await legalVersions.list()).filter((v) => v.legalInstrumentId === legalInstrumentId && v.jurisdiction === jurisdiction);
    const active = versions.filter((v) => v.amendmentState === "in_force").sort((a, b) => String(b.validFrom).localeCompare(String(a.validFrom)));
    if (active.length > 1) throw new Error("Multiple in-force legal versions detected");
    return { legalInstrumentId, jurisdiction, active: active[0] || null, versions };
  }

  async function markStale({ sourceId, actor, reason }) {
    requireActor(actor); if (!reason) throw new Error("Stale-source reason is required");
    const source = await sources.getById(sourceId); if (!source) throw new Error("Source was not found");
    return sources.update(source.id, { verificationState: "stale", staleReason: reason, staleAt: clock().toISOString(), markedStaleBy: actor.id });
  }

  async function auditEvent(eventType, record, actor, payload) {
    if (!audit?.create) return;
    await audit.create({ id: crypto.randomUUID(), actorId: actor.id, actorType: actor.type || "user", eventType, matterId: null, payloadJson: { recordId: record.id, ...payload }, createdAt: clock().toISOString() }, actor);
  }
  return Object.freeze({ acquire, verify, publishVersion, reconcile, markStale });
}

function requireActor(actor) { if (!actor?.id) throw new Error("Authenticated actor is required"); }
function requireValue(value, name) { if (!value) throw new Error(`${name} is required`); }
function sha256(body) { return crypto.createHash("sha256").update(body).digest("hex"); }

module.exports = { AMENDMENT_STATES, VERIFIED_STATES, createVerifiedLegalSourcePipeline, sha256 };
