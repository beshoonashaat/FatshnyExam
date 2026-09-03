import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';

import { EXAM_ID, EXAM_TITLE, questions } from '@/lib/exam';
import {
  deleteSubmission,
  getExamState,
  saveSubmission,
} from '@/lib/storage';

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

    // Validate exam ID
    if (body.examId !== EXAM_ID) {
      return NextResponse.json(
        {
          message: 'امتحان غير صالح.',
        },
        {
          status: 400,
        }
      );
    }

    // Validate participant data
    const participant = body.participant;

    if (
      !participant?.fullName?.trim() ||
      !participant?.phone?.trim() ||
      !participant?.attendanceNumber?.trim()
    ) {
      return NextResponse.json(
        {
          message: 'بيانات الممتحن غير مكتملة.',
        },
        {
          status: 400,
        }
      );
    }

    // Fresh exam status check
    let state = await getExamState(true);

    if (state.status !== 'OPEN') {
      return NextResponse.json(
        {
          code: 'EXAM_CLOSED',
          message:
            'تم إغلاق الامتحان. لم يعد الامتحان يستقبل إجابات جديدة، لذلك لم يتم تسجيل هذا التسليم.',
        },
        {
          status: 423,
        }
      );
    }

    const now = new Date();

    const startedAt = new Date(body.startedAt);

    const safeStartedAt = isNaN(startedAt.getTime()) ? now : startedAt;

    // Build answers object
    const answers: Record<string, string> = {};

    for (const question of questions) {
      answers[question.id] = String(
        body.answers?.[question.id] ?? ''
      );
    }

    // Create submission
    const submission: Submission = {
      version: 1,

      submissionCode: generateSubmissionCode(),

      examId: EXAM_ID,

      examTitle: EXAM_TITLE,

      participant: {
        fullName: String(participant.fullName),
        phone: String(participant.phone),
        attendanceNumber: String(
          participant.attendanceNumber
        ),
      },

      sessionId: String(body.sessionId || ''),

      startedAt: safeStartedAt.toISOString(),

      submittedAt: now.toISOString(),

      durationSeconds: Math.max(
        0,
        Math.round(
          (now.getTime() - safeStartedAt.getTime()) / 1000
        )
      ),

      answeredCount: Object.values(answers).filter(
        (answer) => answer.trim().length > 0
      ).length,

      answers,

      securityEvents: Array.isArray(body.securityEvents)
        ? body.securityEvents.slice(0, 500)
        : [],

      userAgent:
        req.headers.get('user-agent') || undefined,
    };

    /*
     * CRITICAL:
     * Fresh server-side status check immediately
     * before writing the submission.
     */
    state = await getExamState(true);

    if (state.status !== 'OPEN') {
      return NextResponse.json(
        {
          code: 'EXAM_CLOSED',
          message:
            'تم إغلاق الامتحان. لم يعد الامتحان يستقبل إجابات جديدة، لذلك لم يتم تسجيل هذا التسليم.',
        },
        {
          status: 423,
        }
      );
    }

    // Save submission
    const path = await saveSubmission(submission);

    /*
     * Defensive race-condition check.
     *
     * If the admin closed the exam while
     * the submission was being persisted,
     * remove the newly-written submission.
     */
    state = await getExamState(true);

    if (state.status !== 'OPEN') {
      await deleteSubmission(path);

      return NextResponse.json(
        {
          code: 'EXAM_CLOSED',
          message:
            'تم إغلاق الامتحان أثناء التسليم، لذلك لم يتم تسجيل هذا التسليم.',
        },
        {
          status: 423,
        }
      );
    }

    // Success
    return NextResponse.json({
      ok: true,
      submissionCode: submission.submissionCode,
    });
  } catch (error) {
    console.error('Exam submission failed:', error);

    return NextResponse.json(
      {
        message:
          'فشل حفظ التسليم. لم يتم تسجيل الامتحان.',
      },
      {
        status: 500,
      }
    );
  }
}
