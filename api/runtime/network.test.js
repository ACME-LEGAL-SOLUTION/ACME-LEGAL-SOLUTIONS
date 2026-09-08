"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createCollection } = require("./in-memory-repository");
const { createNetworkService } = require("./network-service");

test("partner verification requires evidence", async () => {
  const service = createNetworkService({ repository: createCollection() });
  const actor = { id: "u" };
  const partner = await service.registerPartner({ name: "Partner", jurisdictions: ["IN"], actor });
  await assert.rejects(() => service.verifyPartner(partner, actor), /evidence/);
  const verified = await service.verifyPartner(partner, actor, "verified", [{ type: "registry", ref: "R-1" }]);
  assert.equal(verified.verificationState, "verified");
});
