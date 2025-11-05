/**
 * Authentication utilities
 * Provides password hashing and JWT token generation/verification
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { loadEnvironment } from './environment.js';

const SALT_ROUNDS = 10;

export interface User {
  id: string;
  username: string;
  is_active: boolean;
  must_change_password: boolean;
}

export interface JWTPayload {
  userId: string;
  username: string;
  iat?: number;
  exp?: number;
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a bcrypt hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a JWT token for a user
 */
export function generateJWT(user: User): string {
  const config = loadEnvironment();

  const payload: JWTPayload = {
    userId: user.id,
    username: user.username,
  };

  // Type assertion needed due to @types/jsonwebtoken version compatibility
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  } as any);
}

/**
 * Verify and decode a JWT token
 * Returns the payload if valid, null if invalid
 */
export function verifyJWT(token: string): JWTPayload | null {
  try {
    const config = loadEnvironment();
    const decoded = jwt.verify(token, config.jwtSecret) as JWTPayload;
    return decoded;
  } catch (error) {
    // Token is invalid or expired
    return null;
  }
}

/**
 * Extract JWT token from Authorization header
 * Supports: "Bearer <token>" format
 */
export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0] === 'Bearer') {
    return parts[1];
  }

  return null;
}
