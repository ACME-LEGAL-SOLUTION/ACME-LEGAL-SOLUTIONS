"use strict";

const crypto = require("node:crypto");

const DEFAULT_WINDOW_MS = 5 * 60 * 1000;
const DEFAULT_THRESHOLD = 5;
const ALLOWED_SEVERITIES = new Set(["info", "warning", "high", "critical"]);
const ALLOWED_TYPES = new Set([
  "authentication_failure",
  "authorization_denied",
  "secret_rotation_failure",
  "credential_expiry",
  "provider_failure",
  "webhook_verification_failure",
  "rate_limit_exceeded",
  "incident_declared"
]);

function createSecurityMonitor({ audit = null, clock = () => new Date(), windowMs = DEFAULT_WINDOW_MS, threshold = DEFAULT_THRESHOLD } = {}) {
  if (!Number.isInteger(windowMs) || windowMs <= 0) throw new TypeError("Security monitor window is invalid");
  if (!Number.isInteger(threshold) || threshold <= 0) throw new TypeError("Security monitor threshold is invalid");
  const events = new Map();
  const incidents = new Map();

  function normalize(input = {}) {
    const type = String(input.type || "").trim();
    const severity = String(input.severity || "warning").trim().toLowerCase();
    if (!ALLOWED_TYPES.has(type)) throw new TypeError(`Unsupported security event type: ${type || "unknown"}`);
    if (!ALLOWED_SEVERITIES.has(severity)) throw new TypeError(`Unsupported security severity: ${severity || "unknown"}`);
    const actorId = input.actorId ? String(input.actorId) : "system";
    const matterId = input.matterId ? String(input.matterId) : undefined;
    return Object.freeze({
      id: input.id || crypto.randomUUID(),
      type,
      severity,
      actorId,
      matterId,
      requestId: input.requestId ? String(input.requestId) : undefined,
      provider: input.provider ? String(input.provider) : undefined,
      metadata: sanitizeMetadata(input.metadata || {}),
      occurredAt: input.occurredAt || clock().toISOString()
    });
  }

  async function record(input = {}) {
    const event = normalize(input);
    const now = Date.parse(event.occurredAt) || clock().getTime();
    const key = `${event.type}:${event.actorId}:${event.matterId || "global"}`;
    const history = (events.get(key) || []).filter((timestamp) => now - timestamp < windowMs);
    history.push(now);
    events.set(key, history);
    const count = history.length;
    const escalated = count >= threshold && ["warning", "high", "critical"].includes(event.severity);
    if (audit?.append) {
      await audit.append({
        id: `security-${event.id}`,
        actorId: event.actorId,
        actorType: "security_monitor",
        matterId: event.matterId,
        eventType: `security.${event.type}`,
        payloadJson: { severity: event.severity, requestId: event.requestId, provider: event.provider, metadata: event.metadata, count, escalated },
        createdAt: event.occurredAt
      });
    }
    if (escalated) await declareIncident({ trigger: event, count });
    return Object.freeze({ event, count, escalated });
  }

  async function declareIncident({ trigger, count }) {
    const incidentKey = `${trigger.type}:${trigger.actorId}:${trigger.matterId || "global"}`;
    if (incidents.has(incidentKey)) return incidents.get(incidentKey);
    const incident = Object.freeze({
      id: `incident-${crypto.randomUUID()}`,
      type: "incident_declared",
      severity: trigger.severity === "critical" ? "critical" : "high",
      triggerEventId: trigger.id,
      count,
      declaredAt: clock().toISOString()
    });
    incidents.set(incidentKey, incident);
    if (audit?.append) {
      await audit.append({
        id: incident.id,
        actorId: "system",
        actorType: "security_monitor",
        matterId: trigger.matterId,
        eventType: "security.incident_declared",
        payloadJson: { triggerEventId: trigger.id, triggerType: trigger.type, count, severity: incident.severity },
        createdAt: incident.declaredAt
      });
    }
    return incident;
  }

  function activeIncidents() {
    return Object.freeze([...incidents.values()]);
  }

  return Object.freeze({ record, activeIncidents });
}

function sanitizeMetadata(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) throw new TypeError("Security metadata must be an object");
  const result = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (/password|secret|token|authorization|cookie|phone|email|address|body/i.test(key)) continue;
    if (["string", "number", "boolean"].includes(typeof value) || value === null) result[key] = value;
  }
  return Object.freeze(result);
}

module.exports = { DEFAULT_WINDOW_MS, DEFAULT_THRESHOLD, createSecurityMonitor, sanitizeMetadata };
