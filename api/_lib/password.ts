import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 32;

export interface PasswordRecord {
  salt: string;
  hash: string;
}

export async function hashPassword(password: string): Promise<PasswordRecord> {
  const salt = randomBytes(16);
  const hash = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return { salt: salt.toString("base64"), hash: hash.toString("base64") };
}

export async function verifyPassword(password: string, record: PasswordRecord): Promise<boolean> {
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(record.salt, "base64");
    expected = Buffer.from(record.hash, "base64");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
