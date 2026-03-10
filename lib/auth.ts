type SessionPayload = {
  email: string;
  expiresAt: number;
};

export const SESSION_COOKIE = "lifeops_session";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function getSessionSecret() {
  return process.env.SESSION_SECRET ?? "";
}

function encodeBase64Url(input: ArrayBuffer | Uint8Array | string) {
  const bytes =
    typeof input === "string" ? encoder.encode(input) : input instanceof Uint8Array ? input : new Uint8Array(input);

  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  const decoded = atob(normalized + padding);
  return Uint8Array.from(decoded, (char) => char.charCodeAt(0));
}

async function getSigningKey() {
  const secret = getSessionSecret();

  if (!secret) {
    return null;
  }

  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export function isAuthConfigured() {
  return Boolean(process.env.AUTH_EMAIL && process.env.SESSION_SECRET);
}

export function getConfiguredEmail() {
  return (process.env.AUTH_EMAIL ?? "").toLowerCase();
}

export function getConfiguredPassword() {
  return process.env.AUTH_PASSWORD ?? "";
}

export async function createSessionToken(email: string) {
  const key = await getSigningKey();

  if (!key) {
    throw new Error("SESSION_SECRET is not configured");
  }

  const payload: SessionPayload = {
    email,
    expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7,
  };
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(encodedPayload));
  return `${encodedPayload}.${encodeBase64Url(signature)}`;
}

export async function verifySessionToken(token: string) {
  const key = await getSigningKey();

  if (!key) {
    return null;
  }

  const [encodedPayload, encodedSignature] = token.split(".");

  if (!encodedPayload || !encodedSignature) {
    return null;
  }

  const isValid = await crypto.subtle.verify(
    "HMAC",
    key,
    decodeBase64Url(encodedSignature),
    encoder.encode(encodedPayload),
  );

  if (!isValid) {
    return null;
  }

  const payload = JSON.parse(decoder.decode(decodeBase64Url(encodedPayload))) as SessionPayload;

  if (payload.expiresAt < Date.now()) {
    return null;
  }

  return payload;
}
