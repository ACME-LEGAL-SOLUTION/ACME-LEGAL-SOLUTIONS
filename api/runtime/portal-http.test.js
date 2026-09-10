"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createPortalHttpBoundary } = require("./portal-http");

function request(path, method = "GET") { return { url: path, method, headers: {} }; }

test("client portal HTTP boundary uses authenticated client identity and blocks cross-client access", async () => {
  const calls = [];
  const boundary = createPortalHttpBoundary({
    portal: { clientDashboard: async (input) => { calls.push(input); return { ok: true }; }, professionalWorkspace: async () => ({}) },
    authenticate: async () => ({ id: "client-user", clientId: "client-1" })
  });
  const result = await boundary.dispatch(request("/api/portal/client"));
  assert.deepEqual(result, { ok: true });
  assert.equal(calls[0].clientId, "client-1");
  await assert.rejects(() => boundary.dispatch(request("/api/portal/client?clientId=client-2")), /Client access denied/);
});

test("professional portal HTTP boundary delegates matter access and relies on portal authorization", async () => {
  const calls = [];
  const boundary = createPortalHttpBoundary({
    portal: { clientDashboard: async () => ({}), professionalWorkspace: async (input) => { calls.push(input); return { matterId: input.matterId }; } },
    authenticate: async () => ({ id: "professional-1", role: "professional", human: true })
  });
  const result = await boundary.dispatch(request("/api/portal/professional?matterId=m1"));
  assert.deepEqual(result, { matterId: "m1" });
  assert.equal(calls[0].matterId, "m1");
});

test("portal HTTP boundary fails closed for unauthenticated, malformed, unsupported and wrong-method requests", async () => {
  const unauthenticated = createPortalHttpBoundary({ portal: { clientDashboard: async () => ({}), professionalWorkspace: async () => ({}) }, authenticate: async () => null });
  await assert.rejects(() => unauthenticated.dispatch(request("/api/portal/client")), /Authenticated actor/);
  const boundary = createPortalHttpBoundary({ portal: { clientDashboard: async () => ({}), professionalWorkspace: async () => ({}) }, authenticate: async () => ({ id: "u", clientId: "c1" }) });
  await assert.rejects(() => boundary.dispatch(request("/api/portal/unknown")), /Unsupported portal route/);
  await assert.rejects(() => boundary.dispatch(request("/api/portal/professional")), /matterId is required/);
  await assert.rejects(() => boundary.dispatch(request("/api/portal/client", "POST")), /Method not allowed/);
});
