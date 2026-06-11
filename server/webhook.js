import { createHmac, timingSafeEqual } from "node:crypto";
import { getJiraConfig } from "./config.js";

export const verifyWebhookSignature = (rawBody, signatureHeader) => {
  const secret = getJiraConfig().webhookSecret;
  if (!secret) return false;
  if (!signatureHeader?.includes("=")) return false;

  const [algorithm, providedDigest] = signatureHeader.split("=", 2);
  if (!/^[a-z0-9-]+$/i.test(algorithm) || !providedDigest) return false;

  let expectedDigest;
  try {
    expectedDigest = createHmac(algorithm, secret)
      .update(rawBody)
      .digest("hex");
  } catch {
    return false;
  }

  const provided = Buffer.from(providedDigest, "hex");
  const expected = Buffer.from(expectedDigest, "hex");
  return (
    provided.length === expected.length && timingSafeEqual(provided, expected)
  );
};

export const parseJiraWebhook = (payload) => {
  const issueKey = payload?.issue?.key;
  const status = payload?.issue?.fields?.status?.name;
  if (!issueKey || !status) return null;
  return { issueKey, status };
};
