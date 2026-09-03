import { createHmac, timingSafeEqual } from 'crypto';

export const EXAM_DURATION_MINUTES = 30;

export interface SignedExamSession {
  sessionId: string;
  examId: string;
  startedAt: string;
  expiresAt: string;
  attendanceNumber: string;
}

function secret() {
  const value = process.env.ADMIN_SESSION_SECRET;
  if (!value) throw new Error('ADMIN_SESSION_SECRET is not configured');
  return value;
}

function encode(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

export function signExamSession(payload: SignedExamSession) {
  const body = encode(JSON.stringify(payload));
  const signature = createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${signature}`;
}

export function verifyExamSession(token: string): SignedExamSession | null {
  try {
    const [body, suppliedSignature] = token.split('.');
    if (!body || !suppliedSignature) return null;
    const expectedSignature = createHmac('sha256', secret()).update(body).digest('base64url');
    const supplied = Buffer.from(suppliedSignature);
    const expected = Buffer.from(expectedSignature);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
    return JSON.parse(decode(body)) as SignedExamSession;
  } catch {
    return null;
  }
}
