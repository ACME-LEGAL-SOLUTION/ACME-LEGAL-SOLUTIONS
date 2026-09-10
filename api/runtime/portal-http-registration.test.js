"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { ROUTES } = require("./http-boundary");
const { CLIENT_PATH, PROFESSIONAL_PATH } = require("./portal-http-server-adapter");

test("HTTP boundary registers both authenticated portal paths", () => {
  assert.equal(ROUTES[CLIENT_PATH], "portal");
  assert.equal(ROUTES[PROFESSIONAL_PATH], "portal");
});
