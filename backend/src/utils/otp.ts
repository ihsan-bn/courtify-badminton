import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

import { env } from "../config/env.js";

export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashOtp(phoneNumber: string, otp: string): string {
  return createHmac("sha256", env.otpPepper)
    .update(`${phoneNumber}:${otp}`, "utf8")
    .digest("hex");
}

export function verifyOtpHash(
  phoneNumber: string,
  otp: string,
  expectedHash: string
): boolean {
  const actual = Buffer.from(hashOtp(phoneNumber, otp), "hex");
  const expected = Buffer.from(expectedHash, "hex");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
