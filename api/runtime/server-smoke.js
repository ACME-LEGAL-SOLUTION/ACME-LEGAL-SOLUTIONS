"use strict";

const assert = require("node:assert/strict");
const { createApplicationRepositories } = require("./repository-factory");
const { createApplicationRuntime } = require("./application-runtime");
const { createHttpServer } = require("./http-server");

async function main() {
  const repositories = createApplicationRepositories();
  const application = createApplicationRuntime({ repositories, provider: { execute: async () => ({ answer: "draft" }) } });
  const server = createHttpServer({ application });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/consultations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Smoke Client", email: "smoke@example.com", summary: "Smoke consultation", jurisdiction: "IN", urgency: "standard" })
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.ok(payload.clientId && payload.matterId);
    assert.equal(payload.intakeState, "intake");
    assert.equal((await repositories.clients.list()).length, 1);
    assert.equal((await repositories.matters.list()).length, 1);
    console.log("ACME HTTP smoke test passed");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; });
module.exports = { main };
