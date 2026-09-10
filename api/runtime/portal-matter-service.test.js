"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createPortalMatterService } = require("./portal-matter-service");
const { createCollection } = require("./in-memory-repository");

function setup() {
  const matters = createCollection();
  const documents = createCollection();
  const evidence = createCollection();
  const workPackages = createCollection();
  const audit = createCollection();
  const crm = { getMatter: async (id) => matters.getById(id) };
  const document = {};
  const evidenceService = {};
  const diary = { listMatter: async () => [{ id: "diary-1" }] };
  return {
    matters,
    workPackages,
    audit,
    portalMatter: createPortalMatterService({
      crm,
      document,
      evidence: evidenceService,
      diary,
      repositories: { matters, documents, evidence, workPackages, audit }
    })
  };
}

test("matter details are scoped to the authenticated client", async () => {
  const { matters, portalMatter } = setup();
  await matters.create({ id: "m1", clientId: "c1", title: "Matter One", issue: "Issue", status: "open" });
  const result = await portalMatter.matterDetails({ matterId: "m1", actor: { id: "client", clientId: "c1" } });
  assert.equal(result.matter.id, "m1");
  assert.equal(result.workPackage, null);
  await assert.rejects(() => portalMatter.matterDetails({ matterId: "m1", actor: { id: "other", clientId: "c2" } }), /Matter access denied/);
});

test("work package creation and transitions persist across service instances", async () => {
  const { matters, workPackages, portalMatter, audit } = setup();
  await matters.create({ id: "m1", clientId: "c1", title: "Matter One", issue: "Issue", jurisdiction: "IN", status: "open" });
  const professional = { id: "p1", role: "professional", human: true };
  const workPackage = await portalMatter.createPackage({
    matterId: "m1", actor: professional,
    input: { facts: [], evidence: [], authorities: [], specialistFindings: [], analysis: "Draft", uncertainty: [], confidence: 0.6, recommendedActions: [], requiredDocuments: [], requiredTasks: [] }
  });
  assert.equal(workPackage.state, "review");
  assert.equal((await workPackages.list()).length, 1);
  await assert.rejects(() => portalMatter.transitionPackage({ matterId: "m1", targetState: "approved", actor: { id: "ai", role: "professional", human: false } }), /Authorized human professional|Approval requires explicit human action/);
  const approved = await portalMatter.transitionPackage({ matterId: "m1", targetState: "approved", actor: professional });
  assert.equal(approved.state, "approved");
  const finalized = await portalMatter.transitionPackage({ matterId: "m1", targetState: "finalized", actor: professional, provenance: [{ type: "source", id: "src-1" }] });
  assert.equal(finalized.state, "finalized");
  assert.equal(finalized.provenance.length, 1);
  assert.equal((await audit.list()).length, 3);

  const secondInstance = createPortalMatterService({ crm: { getMatter: async (id) => matters.getById(id) }, document, evidence: evidenceService, diary, repositories: { matters, documents, evidence, workPackages, audit } });
  const persisted = await secondInstance.matterDetails({ matterId: "m1", actor: professional });
  assert.equal(persisted.workPackage.state, "finalized");
  assert.equal(persisted.workPackage.provenance.length, 1);
});
