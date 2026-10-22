const assert = require("node:assert/strict");
const { test } = require("node:test");
const { findVelaCity } = require("../dist/velas/vela.locations.js");

test("returns null when GeoNames reports a city that does not exist", async (t) => {
  const previousUsername = process.env.GEONAMES_USERNAME;
  const previousFetch = global.fetch;
  process.env.GEONAMES_USERNAME = "test-user";
  global.fetch = async () =>
    new Response(
      JSON.stringify({ status: { value: 15, message: "no result found" } }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );

  t.after(() => {
    if (previousUsername === undefined) delete process.env.GEONAMES_USERNAME;
    else process.env.GEONAMES_USERNAME = previousUsername;
    global.fetch = previousFetch;
  });

  assert.equal(await findVelaCity("123"), null);
});

test("preserves GeoNames provider failures for service-unavailable handling", async (t) => {
  const previousUsername = process.env.GEONAMES_USERNAME;
  const previousFetch = global.fetch;
  process.env.GEONAMES_USERNAME = "test-user";
  global.fetch = async () => new Response("unavailable", { status: 503 });

  t.after(() => {
    if (previousUsername === undefined) delete process.env.GEONAMES_USERNAME;
    else process.env.GEONAMES_USERNAME = previousUsername;
    global.fetch = previousFetch;
  });

  await assert.rejects(
    findVelaCity("123"),
    /GeoNames returned HTTP 503/,
  );
});
