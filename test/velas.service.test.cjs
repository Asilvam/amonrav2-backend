const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createHash } = require("node:crypto");
const { VelasService } = require("../dist/velas/velas.service.js");

function makeService({ createdCandle, trackedCandle } = {}) {
  const state = { created: null, trackQuery: null };
  const velaModel = {
    create: async (value) => {
      state.created = value;
      return createdCandle ?? value;
    },
    findOne: (query) => {
      state.trackQuery = query;
      return {
        select: () => ({
          exec: async () => trackedCandle ?? null,
        }),
      };
    },
    find: () => ({
      sort() {
        return this;
      },
      skip() {
        return this;
      },
      limit() {
        return this;
      },
      exec: async () => [],
    }),
  };
  const rateLimitModel = {
    findOneAndUpdate: () => ({
      exec: async () => ({ hits: 1 }),
    }),
  };
  return {
    service: new VelasService(velaModel, rateLimitModel),
    state,
  };
}

const dto = {
  intention: "Esperanza",
  dedication: "Que llegue la calma",
  name: "Ana",
  color: "marfil",
  publishLocation: false,
};

test("creates an independent candle and returns its private tracking token once", async () => {
  const { service, state } = makeService();
  const result = await service.create(dto, "127.0.0.1");

  assert.match(result.candle.id, /^V-[A-F0-9]{24}$/u);
  assert.equal(result.candle.intention, dto.intention);
  assert.equal(result.candle.color, dto.color);
  assert.equal(result.candle.publishLocation, false);
  assert.match(result.trackingToken, /^[A-Za-z0-9_-]{43}$/u);
  assert.equal(
    state.created.trackingTokenHash,
    createHash("sha256").update(result.trackingToken).digest("hex"),
  );
  assert.equal(Object.hasOwn(result.candle, "trackingTokenHash"), false);
  assert.equal(Object.hasOwn(result.candle, "countryCode"), false);
  assert.equal(Object.hasOwn(result.candle, "cityName"), false);
});

test("never exposes stored location unless publication consent was granted", async () => {
  const token = "b".repeat(43);
  const { service } = makeService({
    trackedCandle: {
      reference: "V-AAAAAAAAAAAAAAAAAAAAAAAA",
      intention: "Calma",
      dedication: "",
      name: "",
      color: "azul",
      startedAt: new Date("2026-01-02T03:04:05Z"),
      countryCode: "CL",
      cityName: "Santiago",
      publishLocation: false,
      trackingTokenHash: createHash("sha256").update(token).digest("hex"),
    },
  });

  const result = await service.track(
    { reference: "V-AAAAAAAAAAAAAAAAAAAAAAAA", trackingToken: token },
    "127.0.0.1",
  );

  assert.equal(Object.hasOwn(result.candle, "countryCode"), false);
  assert.equal(Object.hasOwn(result.candle, "cityName"), false);
});

test("returns the public location only for an authorized candle", async () => {
  const token = "a".repeat(43);
  const trackingTokenHash = createHash("sha256").update(token).digest("hex");
  const candle = {
    reference: "V-AAAAAAAAAAAAAAAAAAAAAAAA",
    intention: "Calma",
    dedication: "",
    name: "",
    color: "azul",
    startedAt: new Date("2026-01-02T03:04:05Z"),
    countryCode: "CL",
    cityName: "Santiago",
    publishLocation: true,
    trackingTokenHash,
  };
  const { service, state } = makeService({ trackedCandle: candle });
  const result = await service.track(
    { reference: candle.reference, trackingToken: token },
    "127.0.0.1",
  );

  assert.deepEqual(result.candle, {
    id: candle.reference,
    intention: "Calma",
    dedication: "",
    name: "",
    color: "azul",
    startedAt: "2026-01-02T03:04:05.000Z",
    publishLocation: true,
    countryCode: "CL",
    cityName: "Santiago",
  });
  assert.deepEqual(state.trackQuery, { reference: candle.reference });
});
