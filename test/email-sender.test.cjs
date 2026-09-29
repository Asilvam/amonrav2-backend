const assert = require("node:assert/strict");
const { afterEach, test } = require("node:test");
const { EmailSenderService } = require("../dist/petitions/email-sender.service.js");

const savedEnv = {
  EMAIL_SERVICE_API_URL: process.env.EMAIL_SERVICE_API_URL,
  EMAIL_SERVICE_URL: process.env.EMAIL_SERVICE_URL,
  EMAIL_SERVICE_API_KEY: process.env.EMAIL_SERVICE_API_KEY,
};
const originalFetch = global.fetch;

afterEach(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  global.fetch = originalFetch;
});

test("uses the configured /email URL and the private internal API key", async () => {
  process.env.EMAIL_SERVICE_API_URL = "http://localhost:3000/email";
  process.env.EMAIL_SERVICE_URL = "";
  process.env.EMAIL_SERVICE_API_KEY = "unit-test-key";
  let call;
  global.fetch = async (url, options) => {
    call = { url: String(url), options };
    return new Response("{}", { status: 201 });
  };

  const sender = new EmailSenderService();
  assert.equal(await sender.send("person@example.test", "subject", "text", "<p>body</p>"), true);
  assert.equal(call.url, "http://localhost:3000/email/send");
  assert.equal(call.options.headers["X-Internal-API-Key"], "unit-test-key");
  assert.equal(JSON.parse(call.options.body).to, "person@example.test");
});

test("returns false when the mail microservice responds with an error", async () => {
  process.env.EMAIL_SERVICE_API_URL = "http://localhost:3000/email";
  process.env.EMAIL_SERVICE_API_KEY = "unit-test-key";
  global.fetch = async () => new Response("", { status: 503 });

  const sender = new EmailSenderService();
  assert.equal(await sender.send("person@example.test", "subject", "text", "<p>body</p>"), false);
});

test("returns false when the mail microservice cannot be reached", async () => {
  process.env.EMAIL_SERVICE_API_URL = "http://localhost:3000/email";
  process.env.EMAIL_SERVICE_API_KEY = "unit-test-key";
  global.fetch = async () => {
    throw new Error("network unavailable");
  };

  const sender = new EmailSenderService();
  assert.equal(await sender.send("person@example.test", "subject", "text", "<p>body</p>"), false);
});
