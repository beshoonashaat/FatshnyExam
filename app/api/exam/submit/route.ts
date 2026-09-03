import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { EXAM_ID, EXAM_TITLE, questions } from '@/lib/exam';
import { verifyExamSession } from '@/lib/exam-session';
import { deleteSubmission, getExamState, saveSubmission } from '@/lib/storage';
import type { Submission } from '@/lib/types';

export const dynamic = 'force-dynamic';

function generateSubmissionCode() {
  return 'REV-' + randomBytes(5).toString('base64url').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6).padEnd(6, 'X');
}

function timeExpiredResponse() {
  return NextResponse.json(
    { code: 'EXAM_TIME_EXPIRED', message: 'انتهى وقت الامتحان. مدة الامتحان 30 دقيقة ولم يعد من الممكن إرسال الإجابات.' },
    { status: 408 }
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body.examId !== EXAM_ID) return NextResponse.json({ message: 'امتحان غير صالح.' }, { status: 400 });

    const participant = body.participant;
    if (!participant?.fullName?.trim() || !participant?.phone?.trim() || !participant?.attendanceNumber?.trim()) {
      return NextResponse.json({ message: 'بيانات الممتحن غير مكتملة.' }, { status: 400 });
    }

    const signedSession = verifyExamSession(String(body.sessionToken || ''));
    if (
      !signedSession ||
      signedSession.examId !== EXAM_ID ||
      signedSession.sessionId !== String(body.sessionId || '') ||
      signedSession.attendanceNumber !== String(participant.attendanceNumber)
    ) {
      return NextResponse.json({ message: 'جلسة الامتحان غير صالحة. أعد فتح الامتحان من البداية.' }, { status: 401 });
    }

    if (Date.now() >= new Date(signedSession.expiresAt).getTime()) return timeExpiredResponse();

    let state = await getExamState(true);
    if (state.status !== 'OPEN') {
      return NextResponse.json(
        { code: 'EXAM_CLOSED', message: 'تم إغلاق الامتحان. لم يعد الامتحان يستقبل إجابات جديدة، لذلك لم يتم تسجيل هذا التسليم.' },
        { status: 423 }
      );
    }

    const now = new Date();
    const startedAt = new Date(signedSession.startedAt);
    const answers: Record<string, string> = {};
    for (const question of questions) answers[question.id] = String(body.answers?.[question.id] ?? '');

    const submission: Submission = {
      version: 1,
      submissionCode: generateSubmissionCode(),
      examId: EXAM_ID,
      examTitle: EXAM_TITLE,
      participant: {
        fullName: String(participant.fullName),
        phone: String(participant.phone),
        attendanceNumber: String(participant.attendanceNumber),
      },
      sessionId: signedSession.sessionId,
      startedAt: signedSession.startedAt,
      submittedAt: now.toISOString(),
      durationSeconds: Math.max(0, Math.round((now.getTime() - startedAt.getTime()) / 1000)),
      answeredCount: Object.values(answers).filter((answer) => answer.trim().length > 0).length,
      answers,
      securityEvents: Array.isArray(body.securityEvents) ? body.securityEvents.slice(0, 500) : [],
      userAgent: req.headers.get('user-agent') || undefined,
    };

    // Authoritative checks immediately before persistence.
    if (Date.now() >= new Date(signedSession.expiresAt).getTime()) return timeExpiredResponse();
    state = await getExamState(true);
    if (state.status !== 'OPEN') {
      return NextResponse.json(
        { code: 'EXAM_CLOSED', message: 'تم إغلاق الامتحان. لم يعد الامتحان يستقبل إجابات جديدة، لذلك لم يتم تسجيل هذا التسليم.' },
        { status: 423 }
      );
    }

    const path = await saveSubmission(submission);

    // Defensive race checks after persistence.
    state = await getExamState(true);
    if (state.status !== 'OPEN' || Date.now() >= new Date(signedSession.expiresAt).getTime()) {
      await deleteSubmission(path);
      if (state.status !== 'OPEN') {
        return NextResponse.json({ code: 'EXAM_CLOSED', message: 'تم إغلاق الامتحان أثناء التسليم، لذلك لم يتم تسجيل هذا التسليم.' }, { status: 423 });
      }
      return timeExpiredResponse();
    }

    return NextResponse.json({ ok: true, submissionCode: submission.submissionCode });
  } catch (error) {
    console.error('Exam submission failed:', error);
    return NextResponse.json({ message: 'فشل حفظ التسليم. لم يتم تسجيل الامتحان.' }, { status: 500 });
  }
}
