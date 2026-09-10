"use strict";

const assert = require("node:assert/strict");
const { rankAuthorities } = require("./authority-priority");

describe("authority priority", () => {
  it("ranks primary authorities before lower-priority material", () => {
    const input = [
      { authorityType: "secondary", id: "s" },
      { authorityType: "supreme_court", id: "c" },
      { authorityType: "legislation", id: "l" }
    ];
    assert.deepEqual(rankAuthorities(input).map((x) => x.id), ["l", "c", "s"]);
  });

  it("preserves stable order for equal priority", () => {
    const input = [{ authorityType: "tribunal", id: "a" }, { authorityType: "tribunal", id: "b" }];
    assert.deepEqual(rankAuthorities(input).map((x) => x.id), ["a", "b"]);
  });
});
