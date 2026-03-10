import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const HASH_PREFIX = "scrypt";
const SALT_BYTES = 16;
const KEY_LENGTH = 64;

export function hashPassword(password: string) {
  const salt = randomBytes(SALT_BYTES);
  const derivedKey = scryptSync(password, salt, KEY_LENGTH);

  return `${HASH_PREFIX}:${salt.toString("base64")}:${derivedKey.toString("base64")}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [prefix, saltValue, hashValue] = storedHash.split(":");

  if (prefix !== HASH_PREFIX || !saltValue || !hashValue) {
    return false;
  }

  const salt = Buffer.from(saltValue, "base64");
  const expectedHash = Buffer.from(hashValue, "base64");
  const derivedKey = scryptSync(password, salt, expectedHash.length);

  return timingSafeEqual(derivedKey, expectedHash);
}
