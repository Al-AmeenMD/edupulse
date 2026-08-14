import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { jwtVerify } from "jose";
import { Role } from "@prisma/client";

function getJwtSecret(): string {
  return process.env.JWT_SECRET || "fallback-secret-key-edupulse-production";
}

function getJwtSecretKey(): Uint8Array {
  return new TextEncoder().encode(getJwtSecret());
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: {
  userId: string;
  role: Role;
  schoolId: string | null;
}) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
}

/**
 * Synchronous JWT verification for Node.js API runtime handlers.
 * Uses `jsonwebtoken` with mandatory HMAC signature verification.
 */
export function verifyToken(token: string): {
  userId: string;
  role: Role;
  schoolId: string | null;
  exp?: number;
} {
  return jwt.verify(token, getJwtSecret()) as {
    userId: string;
    role: Role;
    schoolId: string | null;
    exp?: number;
  };
}

/**
 * Async Web Crypto API JWT verification for Edge Runtime middleware.
 * Uses `jose` with mandatory HMAC signature verification.
 */
export async function verifyTokenAsync(token: string): Promise<{
  userId: string;
  role: Role;
  schoolId: string | null;
  exp?: number;
}> {
  const { payload } = await jwtVerify(token, getJwtSecretKey());
  return payload as unknown as {
    userId: string;
    role: Role;
    schoolId: string | null;
    exp?: number;
  };
}
