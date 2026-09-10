"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createPortalMatterHttpBoundary } = require("./portal-matter-http");

function req(path, method = "GET") { return { url: path, method, headers: {} }; }

test("portal matter HTTP boundary authenticates matter reads and delegates", async () => {
  const calls = [];
  const boundary = createPortalMatterHttpBoundary({
    portalMatter: {
      matterDetails: async (input) => { calls.push(["details", input]); return { id: input.matterId }; },
      createPackage: async () => ({}),
      transitionPackage: async () => ({})
    },
    authenticate: async () => ({ id: "client-1", clientId: "c1" })
  });
  assert.deepEqual(await boundary.dispatch(req("/api/portal/matter?matterId=m1")), { id: "m1" });
  assert.equal(calls[0][1].matterId, "m1");
});

test("work package actions require a human professional and enforce operations", async () => {
  const calls = [];
  const professional = { id: "p1", role: "professional", human: true };
  const boundary = createPortalMatterHttpBoundary({
    portalMatter: {
      matterDetails: async () => ({ matter: { id: "m1" }, workPackage: { state: "review" } }),
      createPackage: async (input) => { calls.push(["create", input]); return { state: "review" }; },
      transitionPackage: async (input) => { calls.push(["transition", input]); return { state: input.targetState }; }
    },
    authenticate: async () => professional
  });
  assert.deepEqual(await boundary.dispatch(req("/api/portal/work-package?matterId=m1")), { matterId: "m1", workPackage: { state: "review" } });
  assert.deepEqual(await boundary.dispatch({ url: "/api/portal/work-package/action?matterId=m1", method: "POST", headers: {} }, { operation: "approved" }), { state: "approved" });
  assert.equal(calls[0][1].matterId, "m1");
  assert.equal(calls[0][1].targetState, "approved");
  assert.equal(calls[0][1].actor, professional);
});

test("work package creation routes through governed service", async () => {
  const boundary = createPortalMatterHttpBoundary({
    portalMatter: {
      matterDetails: async () => ({ matter: { id: "m1" }, workPackage: null }),
      createPackage: async ({ matterId, input, actor }) => ({ matterId, input, actor })
    },
    authenticate: async () => ({ id: "p1", role: "professional", human: true })
  });
  const result = await boundary.dispatch({ url: "/api/portal/work-package/action?matterId=m1", method: "POST", headers: {} }, { operation: "create", workPackage: { facts: [], evidence: [], authorities: [], specialistFindings: [], analysis: "Draft", uncertainty: [], confidence: 0.5, recommendedActions: [], requiredDocuments: [], requiredTasks: [] } });
  assert.equal(result.matterId, "m1");
});

test("portal matter HTTP boundary fails closed", async () => {
  const boundary = createPortalMatterHttpBoundary({
    portalMatter: { matterDetails: async () => ({}), createPackage: async () => ({}), transitionPackage: async () => ({}) },
    authenticate: async () => null
  });
  await assert.rejects(() => boundary.dispatch(req("/api/portal/matter?matterId=m1")), /Authenticated actor/);
  const authenticated = createPortalMatterHttpBoundary({
    portalMatter: { matterDetails: async () => ({ matter: null, workPackage: null }), createPackage: async () => ({}), transitionPackage: async () => ({}) },
    authenticate: async () => ({ id: "u", clientId: "c1" })
  });
  await assert.rejects(() => authenticated.dispatch(req("/api/portal/work-package")), /matterId is required/);
  const wrongMethod = createPortalMatterHttpBoundary({ portalMatter: {}, authenticate: async () => ({ id: "u" }) });
  await assert.rejects(() => wrongMethod.dispatch(req("/api/portal/matter?matterId=m1", "POST")), /Method not allowed/);
});
