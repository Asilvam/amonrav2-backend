const assert = require("node:assert/strict");
const { afterEach, test } = require("node:test");
const { BadRequestException } = require("@nestjs/common");
const { createHash } = require("node:crypto");
const { PetitionsService } = require("../dist/petitions/petitions.service.js");

const savedEnv = {
  SESSION_SECRET: process.env.SESSION_SECRET,
  PUBLIC_SITE_URL: process.env.PUBLIC_SITE_URL,
  PETITIONS_NOTIFY_TO: process.env.PETITIONS_NOTIFY_TO,
};

afterEach(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function makeService(overrides = {}) {
  process.env.SESSION_SECRET = "unit-test-session-secret";
  process.env.PUBLIC_SITE_URL = "https://amonra.example";
  process.env.PETITIONS_NOTIFY_TO = "info@amonra.cl,alesoft.silva.m@gmail.com";
  const state = {
    created: null,
    updateQuery: null,
    updateValues: null,
    selectedFields: null,
    expirationQuery: null,
    expirationUpdate: null,
    email: null,
    emails: [],
  };
  const petitions = {
    create: async (data) => {
      state.created = data;
      return { reference: data.reference };
    },
    updateMany: async (query, update) => {
      state.expirationQuery = query;
      state.expirationUpdate = update;
      return { modifiedCount: overrides.expiredCount || 0 };
    },
    findOneAndUpdate: (query, update) => {
      state.updateQuery = query;
      state.updateValues = update;
      const suppliedHash = createHash("sha256")
        .update(overrides.validConfirmationToken || "")
        .digest("hex");
      const matchesToken = suppliedHash === query.confirmationTokenHash;
      const isUnexpired = query.confirmationExpiresAt.$gt instanceof Date;
      const result =
        overrides.confirmResult !== undefined
          ? overrides.confirmResult
          : matchesToken &&
              isUnexpired &&
              query.status === "pending_confirmation"
            ? { reference: "AM-0123456789AB", status: update.$set.status }
            : null;
      return {
        select: async (fields) => {
          state.selectedFields = fields;
          return result;
        },
      };
    },
    findOne: () => ({
      select: async () => overrides.statusPetition || null,
    }),
    find: () => ({
      select() {
        return this;
      },
      sort() {
        return this;
      },
      limit() {
        return this;
      },
      lean: async () => [],
    }),
  };
  const rateLimits = {
    findOneAndUpdate: async () => ({ hits: 1 }),
  };
  const emails = {
    send: async (...args) => {
      state.email = args;
      state.emails.push(args);
      return overrides.emailResult ?? true;
    },
  };
  const blockedContacts = overrides.blockedContacts || {
    exists: async () => false,
  };
  return {
    service: new PetitionsService(
      petitions,
      rateLimits,
      emails,
      blockedContacts,
    ),
    state,
  };
}

const requestDto = {
  kind: "Cadena de oración",
  duration: "Una semana",
  message: "Por la salud de mi familia",
  name: "Ana",
  country: "Chile",
  city: "Santiago",
  email: " ANA@example.test ",
  share: false,
  consent: true,
};

test("stores a pending request and sends confirmation with a token expiring within 24 hours", async () => {
  const before = Date.now();
  const { service, state } = makeService();
  const result = await service.create(requestDto, "127.0.0.1");

  assert.match(result.reference, /^AM-[A-F0-9]{12}$/u);
  assert.equal(result.confirmationSent, true);
  assert.equal(state.created.status, "pending_confirmation");
  assert.equal(state.created.email, "ana@example.test");
  assert.equal(state.created.country, "Chile");
  assert.equal(state.created.city, "Santiago");
  assert.equal(state.created.share, false);
  assert.equal(state.created.confirmationTokenHash.length, 64);
  assert.equal(state.created.trackingTokenHash.length, 64);
  assert.ok(state.created.confirmationExpiresAt.getTime() > before);
  assert.ok(
    state.created.confirmationExpiresAt.getTime() <=
      before + 24 * 60 * 60 * 1000 + 1000,
  );
  assert.equal(state.emails.length, 3);
  assert.equal(state.emails[0][0], "ana@example.test");
  assert.equal(state.emails[1][0], "info@amonra.cl");
  assert.equal(state.emails[2][0], "alesoft.silva.m@gmail.com");
  assert.match(state.emails[0][2], /vence en 24 horas/u);
  assert.match(state.emails[1][2], /País: Chile/u);
  assert.match(state.emails[1][2], /Ciudad: Santiago/u);
  assert.match(state.emails[2][2], /País: Chile/u);
  assert.match(state.emails[2][2], /Ciudad: Santiago/u);
  assert.equal(Object.hasOwn(result, "trackingToken"), false);
});

test("email failure leaves a saved request and reports that confirmation was not sent", async () => {
  const { service, state } = makeService({ emailResult: false });
  const result = await service.create(requestDto, "127.0.0.1");
  assert.ok(state.created);
  assert.equal(state.created.status, "pending_confirmation");
  assert.equal(result.confirmationSent, false);
});

test("archives pending requests whose confirmation window has expired", async () => {
  const { service, state } = makeService({ expiredCount: 2 });

  await service.list("all");

  assert.equal(state.expirationQuery.status, "pending_confirmation");
  assert.ok(state.expirationQuery.confirmationExpiresAt.$lte instanceof Date);
  assert.equal(state.expirationUpdate.$set.status, "expired");
  assert.ok(state.expirationUpdate.$unset.confirmationTokenHash);
  assert.ok(state.expirationUpdate.$unset.confirmationExpiresAt);
});

test("rejects a new request when its email is blocked", async () => {
  const blockedContacts = {
    exists: async (query) =>
      query.type === "email" && query.normalizedValue === "ana@example.test",
  };
  const { service, state } = makeService({ blockedContacts });

  await assert.rejects(
    () => service.create(requestDto, "127.0.0.1"),
    BadRequestException,
  );
  assert.equal(state.created, null);
});

test("confirmation consumes a valid pending token exactly once", async () => {
  const confirmationToken = "a".repeat(43);
  const { service, state } = makeService({
    validConfirmationToken: confirmationToken,
  });
  const result = await service.confirm(confirmationToken);
  assert.equal(result.status, "received");
  assert.equal(state.selectedFields, "+trackingTokenEncrypted");
  assert.equal(state.updateQuery.status, "pending_confirmation");
  assert.ok(state.updateQuery.confirmationExpiresAt.$gt instanceof Date);
  assert.equal(state.updateValues.$set.status, "received");
  assert.ok(state.updateValues.$unset.confirmationTokenHash);
});

test("rejects expired, unknown, or already-consumed confirmation tokens", async () => {
  const { service } = makeService({ validConfirmationToken: "a".repeat(43) });
  await assert.rejects(
    () => service.confirm("b".repeat(43)),
    BadRequestException,
  );
});

test("public status lookup returns status and dates only when the tracking token matches", async () => {
  const trackingToken = "c".repeat(43);
  const digest = require("node:crypto")
    .createHash("sha256")
    .update(trackingToken)
    .digest("hex");
  const createdAt = new Date("2026-01-02T03:04:05Z");
  const updatedAt = new Date("2026-01-03T03:04:05Z");
  const { service } = makeService({
    statusPetition: {
      reference: "AM-0123456789AB",
      status: "completed",
      createdAt,
      updatedAt,
      trackingTokenHash: digest,
      message: "must not be returned",
      email: "private@example.test",
    },
  });
  const result = await service.status(
    { reference: "am-0123456789ab", trackingToken },
    "127.0.0.1",
  );
  assert.deepEqual(result, {
    reference: "AM-0123456789AB",
    status: "completed",
    createdAt,
    updatedAt,
  });
});
