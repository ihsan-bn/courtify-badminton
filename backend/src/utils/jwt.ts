import jwt, { type SignOptions } from "jsonwebtoken";

import { env } from "../config/env.js";
import { UnauthorizedError } from "./errors.js";

export type UserRole = "customer" | "admin";

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
}

const tokenOptions = {
  algorithm: "HS256",
  issuer: "courtify-badminton",
  audience: "courtify-badminton-api"
} as const;

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, {
    ...tokenOptions,
    expiresIn: env.jwtExpiresIn as NonNullable<SignOptions["expiresIn"]>
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.jwtSecret, tokenOptions);
    const role =
      typeof decoded === "string"
        ? undefined
        : (decoded.role as unknown);

    if (
      typeof decoded === "string" ||
      typeof decoded.sub !== "string" ||
      (role !== "customer" && role !== "admin")
    ) {
      throw new UnauthorizedError("Invalid access token");
    }

    return { sub: decoded.sub, role };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    throw new UnauthorizedError("Invalid or expired access token");
  }
}
