import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { getVaultConfig } from "../config.js";

const key = () =>
  createHash("sha256").update(getVaultConfig().encryptionKey).digest();

export const encryptSecret = (value) => {
  if (!value) return "";
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([
    cipher.update(String(value), "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
};

export const decryptSecret = (value) => {
  if (!value) return "";
  const [version, iv, tag, encrypted] = String(value).split(".");
  if (version !== "v1" || !iv || !tag || !encrypted) {
    throw new Error("Invalid encrypted vault value");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]).toString("utf8");
};
