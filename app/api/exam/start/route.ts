import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { getExamState } from '@/lib/storage';
import { EXAM_ID } from '@/lib/exam';
import { EXAM_DURATION_MINUTES, signExamSession } from '@/lib/exam-session';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || body.examId !== EXAM_ID) {
    return NextResponse.json({ message: 'امتحان غير صالح.' }, { status: 400 });
  }

  const participant = body.participant;
  if (!participant?.fullName?.trim() || !participant?.phone?.trim() || !participant?.attendanceNumber?.trim()) {
    return NextResponse.json({ message: 'كل بيانات الممتحن مطلوبة.' }, { status: 400 });
  }

  const state = await getExamState(true);
  if (state.status !== 'OPEN') {
    return NextResponse.json(
      { status: state.status, code: 'EXAM_CLOSED', message: 'تم إغلاق الامتحان. الامتحان لا يستقبل إجابات جديدة حاليًا.' },
      { status: 423 }
    );
  }

  const started = new Date();
  const expires = new Date(started.getTime() + EXAM_DURATION_MINUTES * 60 * 1000);
  const sessionId = randomBytes(8).toString('hex');
  const startedAt = started.toISOString();
  const expiresAt = expires.toISOString();
  const sessionToken = signExamSession({
    sessionId,
    examId: EXAM_ID,
    startedAt,
    expiresAt,
    attendanceNumber: String(participant.attendanceNumber),
  });

  return NextResponse.json(
    { session: { sessionId, startedAt, expiresAt, sessionToken, participant } },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
