import assert from "node:assert/strict";
import test from "node:test";
import { withRetry } from "../server/retry.js";

test("withRetry retries retryable failures and returns the result", async () => {
  let calls = 0;

  const result = await withRetry(
    async () => {
      calls += 1;
      if (calls < 3) throw Object.assign(new Error("temporary"), { status: 500 });
      return "ok";
    },
    {
      retries: 3,
      baseDelayMs: 0,
      shouldRetry: (error) => error.status >= 500,
    },
  );

  assert.equal(result, "ok");
  assert.equal(calls, 3);
});

test("withRetry does not retry permanent failures", async () => {
  let calls = 0;

  await assert.rejects(
    withRetry(
      async () => {
        calls += 1;
        throw Object.assign(new Error("bad request"), { status: 400 });
      },
      { retries: 3, shouldRetry: (error) => error.status >= 500 },
    ),
  );

  assert.equal(calls, 1);
});
