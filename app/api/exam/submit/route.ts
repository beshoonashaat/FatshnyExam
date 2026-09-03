import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { EXAM_ID, EXAM_TITLE, questions } from '@/lib/exam';
import { deleteSubmission, getExamState, saveSubmission } from '@/lib/storage';
import type { Submission } from '@/lib/types';

export const dynamic = 'force-dynamic';

function generateSubmissionCode() {
  return (
    'REV-' +
    randomBytes(5)
      .toString('base64url')
      .replace(/[^A-Z0-9]/gi, '')
      .toUpperCase()
      .slice(0, 6)
      .padEnd(6, 'X')
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body.examId !== EXAM_ID) {
      return NextResponse.json({ message: 'امتحان غير صالح.' }, { status: 400 });
    }

    const participant = body.participant;
    if (
      !participant?.fullName?.trim() ||
      !participant?.phone?.trim() ||
      !participant?.attendanceNumber?.trim()
    ) {
      return NextResponse.json({ message: 'بيانات الممتحن غير مكتملة.' }, { status: 400 });
    }

    let state = await getExamState(true);
    if (state.status !== 'OPEN') {
      return NextResponse.json(
        {
          code: 'EXAM_CLOSED',
          message: 'تم إغلاق الامتحان. لم يعد الامتحان يستقبل إجابات جديدة، لذلك لم يتم تسجيل هذا التسليم.',
        },
        { status: 423 }
      );
    }

    const now = new Date();
    const startedAt = new Date(body.startedAt);
    const safeStartedAt = isNaN(startedAt.getTime()) ? now : startedAt;
    const answers: Record<string, string> = {};

    for (const question of questions) {
      answers[question.id] = String(body.answers?.[question.id] ?? '');
    }

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
      sessionId: String(body.sessionId || ''),
      startedAt: safeStartedAt.toISOString(),
      submittedAt: now.toISOString(),
      durationSeconds: Math.max(0, Math.round((now.getTime() - safeStartedAt.getTime()) / 1000)),
      answeredCount: Object.values(answers).filter((answer) => answer.trim().length > 0).length,
      answers,
      securityEvents: Array.isArray(body.securityEvents) ? body.securityEvents.slice(0, 500) : [],
      userAgent: req.headers.get('user-agent') || undefined,
    };

    // Critical fresh server-side check immediately before persistence.
    state = await getExamState(true);
    if (state.status !== 'OPEN') {
      return NextResponse.json(
        {
          code: 'EXAM_CLOSED',
          message: 'تم إغلاق الامتحان. لم يعد الامتحان يستقبل إجابات جديدة، لذلك لم يتم تسجيل هذا التسليم.',
        },
        { status: 423 }
      );
    }

    const path = await saveSubmission(submission);

    // Defensive post-write race check. If closure won the race, remove the just-written submission.
    state = await getExamState(true);
    if (state.status !== 'OPEN') {
      await deleteSubmission(path);
      return NextResponse.json(
        {
          code: 'EXAM_CLOSED',
          message: 'تم إغلاق الامتحان أثناء التسليم، لذلك لم يتم تسجيل هذا التسليم.',
        },
        { status: 423 }
      );
    }

    return NextResponse.json({ ok: true, submissionCode: submission.submissionCode });
  } catch (error) {
    console.error('Exam submission failed:', error);
    return NextResponse.json(
      { message: 'فشل حفظ التسليم. لم يتم تسجيل الامتحان.' },
      { status: 500 }
    );
  }
}
