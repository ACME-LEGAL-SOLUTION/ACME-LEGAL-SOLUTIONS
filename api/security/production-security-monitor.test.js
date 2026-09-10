"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createSecurityMonitor } = require("./production-security-monitor");

test("security monitor records safe events and escalates repeated failures", async () => {
  const audit = { events: [], async append(event) { this.events.push(event); } };
  let now = new Date("2026-09-10T00:00:00Z");
  const monitor = createSecurityMonitor({ audit, threshold: 3, windowMs: 300000, clock: () => now });
  await monitor.record({ type: "authentication_failure", severity: "warning", actorId: "user-1", requestId: "req-1", metadata: { endpoint: "/login", password: "redacted" } });
  await monitor.record({ type: "authentication_failure", severity: "warning", actorId: "user-1", requestId: "req-2", metadata: { endpoint: "/login", token: "secret" } });
  const third = await monitor.record({ type: "authentication_failure", severity: "warning", actorId: "user-1", requestId: "req-3", metadata: { endpoint: "/login" } });
  assert.equal(third.count, 3);
  assert.equal(third.escalated, true);
  assert.equal(monitor.activeIncidents().length, 1);
  assert.equal(audit.events.some((event) => event.eventType === "security.incident_declared"), true);
  assert.equal(JSON.stringify(audit.events).includes("secret"), false);
});

test("security monitor expires old events from the detection window", async () => {
  let now = new Date("2026-09-10T00:00:00Z");
  const monitor = createSecurityMonitor({ threshold: 2, windowMs: 1000, clock: () => now });
  await monitor.record({ type: "provider_failure", severity: "warning", actorId: "provider-1" });
  now = new Date(now.getTime() + 2000);
  const result = await monitor.record({ type: "provider_failure", severity: "warning", actorId: "provider-1" });
  assert.equal(result.count, 1);
  assert.equal(result.escalated, false);
});

test("unsupported event types and invalid severity fail closed", () => {
  const monitor = createSecurityMonitor();
  assert.rejects(() => monitor.record({ type: "unknown_event", severity: "warning" }), /Unsupported security event type/);
  assert.rejects(() => monitor.record({ type: "provider_failure", severity: "debug" }), /Unsupported security severity/);
});
