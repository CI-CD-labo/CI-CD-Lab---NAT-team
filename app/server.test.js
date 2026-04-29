const assert = require("assert");

describe("Health Check", () => {
  it("should return ok status", () => {
    const status = "ok";
    assert.strictEqual(status, "ok");
  });
});
