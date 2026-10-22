const assert = require("node:assert/strict");
const { test } = require("node:test");
const { VelasService } = require("../dist/velas/velas.service.js");

function makeService({ createdCandle, listedCandles = [] } = {}) {
  const state = { created: null };
  const velaModel = {
    create: async (value) => {
      state.created = value;
      return createdCandle ?? value;
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
      exec: async () => listedCandles,
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

test("creates a shared candle and returns no private tracking credential", async () => {
  const { service, state } = makeService();
  const result = await service.create(dto, "127.0.0.1");

  assert.match(result.candle.id, /^V-[A-F0-9]{24}$/u);
  assert.equal(result.candle.intention, dto.intention);
  assert.equal(result.candle.color, dto.color);
  assert.equal(result.candle.publishLocation, false);
  assert.deepEqual(Object.keys(result), ["candle"]);
  assert.equal(Object.hasOwn(state.created, "trackingTokenHash"), false);
  assert.equal(Object.hasOwn(result.candle, "trackingTokenHash"), false);
  assert.equal(Object.hasOwn(result.candle, "countryCode"), false);
  assert.equal(Object.hasOwn(result.candle, "cityName"), false);
});

test("lists shared candles and publishes location only with consent", async () => {
  const candles = [
    {
      reference: "V-AAAAAAAAAAAAAAAAAAAAAAAA",
      intention: "Calma",
      dedication: "",
      name: "",
      color: "azul",
      startedAt: new Date("2026-01-02T03:04:05Z"),
      countryCode: "CL",
      cityName: "Santiago",
      publishLocation: false,
    },
    {
      reference: "V-BBBBBBBBBBBBBBBBBBBBBBBB",
      intention: "Esperanza",
      dedication: "",
      name: "",
      color: "marfil",
      startedAt: new Date("2026-01-03T03:04:05Z"),
      countryCode: "CL",
      cityName: "Valparaíso",
      publishLocation: true,
    },
  ];
  const { service } = makeService({ listedCandles: candles });
  const result = await service.list({ limit: 60, skip: 0 });

  assert.equal(result.candles.length, 2);
  assert.equal(Object.hasOwn(result.candles[0], "countryCode"), false);
  assert.equal(Object.hasOwn(result.candles[0], "cityName"), false);
  assert.equal(result.candles[1].countryCode, "CL");
  assert.equal(result.candles[1].cityName, "Valparaíso");
});
