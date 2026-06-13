import test from "node:test";
import assert from "node:assert/strict";
import { decryptSecret, encryptSecret } from "../server/services/vault.js";

test("remote access passwords are encrypted and can be decrypted", () => {
  process.env.ACCESS_VAULT_KEY = "test-only-long-vault-key";
  const encrypted = encryptSecret("CokGizli123!");
  assert.notEqual(encrypted, "CokGizli123!");
  assert.match(encrypted, /^v1\./);
  assert.equal(decryptSecret(encrypted), "CokGizli123!");
});
