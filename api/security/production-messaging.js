"use strict";

const ALLOWED_CHANNELS = new Set(["email", "whatsapp"]);
const STATES = Object.freeze(["queued", "sending", "sent", "delivered", "failed"]);
const TRANSITIONS = Object.freeze({
  queued: ["sending", "failed"],
  sending: ["sent", "failed"],
  sent: ["delivered", "failed"],
  delivered: [],
  failed: ["queued"]
});

const MAX_BODY = 20000;
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_RETRY_BASE_MS = 30_000;
const DEFAULT_RETRY_MAX_MS = 60 * 60 * 1000;

function text(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`${name} is required`);
  }
  return value.trim();
}

function positiveInteger(value, name, fallback) {
  const resolved = value === undefined ? fallback : value;
  if (!Number.isInteger(resolved) || resolved < 1) {
    throw new TypeError(`${name} must be a positive integer`);
  }
  return resolved;
}

function nonNegativeInteger(value, name, fallback) {
  const resolved = value === undefined ? fallback : value;
  if (!Number.isInteger(resolved) || resolved < 0) {
    throw new TypeError(`${name} must be a non-negative integer`);
  }
  return resolved;
}

function retryDelayMs(attemptCount, baseMs, maxMs) {
  const attempt = Math.max(1, Number(attemptCount) || 1);
  return Math.min(maxMs, baseMs * (2 ** (attempt - 1)));
}

function auditEventId(messageId, eventType, timestamp) {
  return `msg-audit-${messageId}-${eventType}-${timestamp}`;
}

function createProductionMessagingProvider({ env = process.env, provider = null } = {}) {
  const resolvedProvider = provider || (() => {
    const name = env.ACME_MESSAGING_PROVIDER_MODULE;
    if (!name) {
      throw new Error(
        "Production messaging provider adapter is not configured (ACME_MESSAGING_PROVIDER_MODULE)"
      );
    }
    return require(name);
  })();

  if (
    !resolvedProvider ||
    typeof resolvedProvider.send !== "function" ||
    typeof resolvedProvider.verifyWebhook !== "function"
  ) {
    throw new TypeError("Messaging provider must expose send and verifyWebhook");
  }

  return Object.freeze({
    id: text(
      resolvedProvider.id || env.ACME_MESSAGING_PROVIDER_ID || "messaging-provider",
      "Messaging provider id"
    ),

    async send(input = {}) {
      if (!ALLOWED_CHANNELS.has(input.channel)) {
        throw new TypeError("Unsupported messaging channel");
      }
      const body = text(input.body, "body");
      if (body.length > MAX_BODY) {
        throw new TypeError("Message body is too large");
      }
      const recipientRef = text(input.recipientRef, "recipientRef");
      const idempotencyKey = text(input.idempotencyKey, "idempotencyKey");

      // The provider receives only delivery fields. Governance/audit callers must
      // never pass actor, matter, client, credentials, or raw audit payload here.
      return resolvedProvider.send({
        channel: input.channel,
        recipientRef,
        body,
        templateId: input.templateId || null,
        templateVersion: input.templateVersion || null,
        idempotencyKey,
        metadata: input.metadata || {}
      });
    },

    async verifyWebhook(input = {}) {
      const signature =
        input.signature ||
        input.headers?.["x-message-signature"] ||
        input.headers?.["X-Message-Signature"];
      text(signature, "Webhook signature");
      return resolvedProvider.verifyWebhook(input);
    }
  });
}

function createMessagingGovernance({
  messageRepository,
  matterAuthorization = null,
  audit = null,
  provider = null,
  clock = () => new Date(),
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  retryBaseMs = DEFAULT_RETRY_BASE_MS,
  retryMaxMs = DEFAULT_RETRY_MAX_MS
} = {}) {
  if (
    !messageRepository?.create ||
    !messageRepository?.getById ||
    !messageRepository?.list ||
    !messageRepository?.update
  ) {
    throw new Error("Message repository is required");
  }

  const attemptsLimit = positiveInteger(maxAttempts, "maxAttempts", DEFAULT_MAX_ATTEMPTS);
  const retryBase = nonNegativeInteger(retryBaseMs, "retryBaseMs", DEFAULT_RETRY_BASE_MS);
  const retryMax = nonNegativeInteger(retryMaxMs, "retryMaxMs", DEFAULT_RETRY_MAX_MS);
  if (retryMax < retryBase) {
    throw new TypeError("retryMaxMs must be greater than or equal to retryBaseMs");
  }

  async function authorize(actor, matterId) {
    if (!actor?.id) {
      throw new Error("Authenticated actor is required");
    }
    if (matterId) {
      if (!matterAuthorization?.assert) {
        throw new Error("Matter authorization is required");
      }
      await matterAuthorization.assert({ actor, matterId });
    }
  }

  async function writeAudit({ message, actor, eventType, payload, now }) {
    if (!audit?.append) return;
    await audit.append({
      id: auditEventId(message.id, eventType, now),
      actorId: actor?.id || "system",
      actorType: actor?.type || "system",
      matterId: message.matterId || null,
      eventType,
      // Deliberately excludes body and recipientRef to keep delivery audit PII-safe.
      payload: payload || { messageId: message.id, status: message.status },
      createdAt: now
    });
  }

  async function enqueue(input = {}) {
    if (!ALLOWED_CHANNELS.has(input.channel)) {
      throw new TypeError("Unsupported messaging channel");
    }
    if (!input.id || !input.idempotencyKey) {
      throw new TypeError("Message id and idempotencyKey are required");
    }
    text(input.recipientRef, "recipientRef");
    await authorize(input.actor, input.matterId);

    const duplicate = await messageRepository.list({
      idempotencyKey: input.idempotencyKey
    });
    if (duplicate.length) {
      return { duplicate: true, message: duplicate[0] };
    }

    const now = clock().toISOString();
    const message = await messageRepository.create({
      id: input.id,
      matterId: input.matterId || null,
      clientId: input.clientId || null,
      channel: input.channel,
      provider: input.provider,
      templateId: input.templateId || null,
      templateVersion: input.templateVersion || null,
      recipientRef: input.recipientRef,
      status: "queued",
      idempotencyKey: input.idempotencyKey,
      attemptCount: 0,
      nextRetryAt: null,
      payloadJson: input.payload || {},
      createdAt: now,
      updatedAt: now
    });

    await writeAudit({
      message,
      actor: input.actor,
      eventType: "messaging.queued",
      payload: { messageId: input.id, channel: input.channel },
      now
    });
    return { duplicate: false, message };
  }

  async function transition({
    id,
    status,
    actor,
    providerMessageId = null,
    failureReason = null
  } = {}) {
    const message = await messageRepository.getById(id);
    if (!message) throw new Error("Message not found");
    await authorize(actor, message.matterId);

    if (!STATES.includes(status) || !TRANSITIONS[message.status]?.includes(status)) {
      throw new Error(`Invalid message transition: ${message.status} -> ${status}`);
    }

    const now = clock().toISOString();
    const changes = { status, updatedAt: now };
    if (status === "sending") {
      changes.attemptCount = Number(message.attemptCount || 0) + 1;
      changes.nextRetryAt = null;
    }
    if (providerMessageId) changes.providerMessageId = providerMessageId;
    if (status === "sent") changes.failureReason = null;
    if (status === "delivered") {
      changes.deliveredAt = now;
      changes.failureReason = null;
      changes.nextRetryAt = null;
    }
    if (status === "failed") {
      changes.failedAt = now;
      changes.failureReason = failureReason || "delivery failed";
      const attempts = Number(message.attemptCount || 0);
      if (attempts < attemptsLimit) {
        changes.nextRetryAt = new Date(
          clock().getTime() + retryDelayMs(attempts, retryBase, retryMax)
        ).toISOString();
      } else {
        changes.nextRetryAt = null;
      }
    }

    const updated = await messageRepository.update(id, changes);
    await writeAudit({
      message: updated || message,
      actor,
      eventType: `messaging.${status}`,
      payload: {
        messageId: id,
        status,
        providerMessageId: providerMessageId || null,
        retryScheduled: Boolean(changes.nextRetryAt),
        nextRetryAt: changes.nextRetryAt || null
      },
      now
    });
    return updated;
  }

  async function retry({ id, actor } = {}) {
    const message = await messageRepository.getById(id);
    if (!message) throw new Error("Message not found");
    await authorize(actor, message.matterId);
    if (message.status !== "failed") {
      throw new Error("Only failed messages can be retried");
    }
    if (Number(message.attemptCount || 0) >= attemptsLimit) {
      throw new Error("Message retry limit exhausted");
    }
    if (message.nextRetryAt && new Date(message.nextRetryAt).getTime() > clock().getTime()) {
      throw new Error("Message retry is not due yet");
    }
    const now = clock().toISOString();
    return transition({ id, status: "queued", actor, failureReason: null, providerMessageId: null })
      .then(async updated => {
        const cleaned = await messageRepository.update(id, {
          failedAt: null,
          failureReason: null,
          nextRetryAt: null,
          updatedAt: now
        });
        return cleaned || updated;
      });
  }

  async function deliver({ id, actor, deliveryProvider = provider } = {}) {
    if (!deliveryProvider?.send) {
      throw new Error("Messaging delivery provider is required");
    }
    const message = await messageRepository.getById(id);
    if (!message) throw new Error("Message not found");
    await authorize(actor, message.matterId);
    if (message.status !== "queued") {
      throw new Error(`Only queued messages can be delivered (current: ${message.status})`);
    }

    const sending = await transition({ id, status: "sending", actor });
    try {
      const payload = sending.payloadJson || {};
      const result = await deliveryProvider.send({
        channel: sending.channel,
        recipientRef: sending.recipientRef,
        body: payload.body || payload.message || "",
        templateId: sending.templateId,
        templateVersion: sending.templateVersion,
        idempotencyKey: sending.idempotencyKey,
        metadata: { messageId: sending.id }
      });
      return transition({
        id,
        status: "sent",
        actor,
        providerMessageId: result?.providerMessageId || result?.id || null
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "delivery failed";
      return transition({ id, status: "failed", actor, failureReason: reason });
    }
  }

  async function handleWebhook({ input, actor = { id: "system-messaging", type: "system" }, deliveryProvider = provider } = {}) {
    if (!deliveryProvider?.verifyWebhook) {
      throw new Error("Messaging webhook verifier is required");
    }
    const verified = await deliveryProvider.verifyWebhook(input || {});
    if (!verified || verified.verified !== true) {
      throw new Error("Messaging webhook verification failed");
    }

    const providerMessageId = text(
      verified.providerMessageId || verified.messageId,
      "providerMessageId"
    );
    const status = text(verified.status, "status");
    const candidates = await messageRepository.list({ providerMessageId });
    const message = candidates[0];
    if (!message) throw new Error("Message not found for verified provider message id");

    // The provider signature establishes authenticity; matter authorization is
    // still enforced when a human/system actor is supplied by the caller.
    return transition({
      id: message.id,
      status,
      actor,
      providerMessageId
    });
  }

  return Object.freeze({
    enqueue,
    transition,
    retry,
    deliver,
    handleWebhook,
    retryDelayMs: (attemptCount) => retryDelayMs(attemptCount, retryBase, retryMax),
    maxAttempts: attemptsLimit
  });
}

module.exports = {
  ALLOWED_CHANNELS,
  STATES,
  TRANSITIONS,
  MAX_BODY,
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_RETRY_BASE_MS,
  DEFAULT_RETRY_MAX_MS,
  retryDelayMs,
  createProductionMessagingProvider,
  createMessagingGovernance
};
