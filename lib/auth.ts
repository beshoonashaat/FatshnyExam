import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
const COOKIE = 'exam_admin_session';
function secret() { return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || 'missing-secret'; }
function sign(payload: string) { return createHmac('sha256', secret()).update(payload).digest('base64url'); }
export function verifyAdminPassword(input: string) {
  const actual = process.env.ADMIN_PASSWORD;
  if (!actual) return false;
  const a = Buffer.from(input); const b = Buffer.from(actual);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function createAdminToken() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 12 * 60 * 60 * 1000 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}
export function verifyAdminToken(token?: string) {
  if (!token) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  const expected = sign(payload);
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  try { const data = JSON.parse(Buffer.from(payload, 'base64url').toString()); return Number(data.exp) > Date.now(); } catch { return false; }
}
export async function isAdmin() { const c = await cookies(); return verifyAdminToken(c.get(COOKIE)?.value); }
export const adminCookie = { name: COOKIE, options: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/', maxAge: 12 * 60 * 60 } };
