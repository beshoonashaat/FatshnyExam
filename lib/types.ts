export type ExamStatus = 'DRAFT' | 'OPEN' | 'CLOSED';
export type CloseMode = 'STOP_NEW_ATTEMPTS' | 'STOP_ALL_SUBMISSIONS';
export type SecurityEventType = 'TAB_HIDDEN' | 'WINDOW_BLUR' | 'COPY_QUESTION_ATTEMPT' | 'RIGHT_CLICK_QUESTION' | 'FULLSCREEN_EXIT';
export interface SecurityEvent { type: SecurityEventType; timestamp: string }
export interface Participant { fullName: string; phone: string; attendanceNumber: string }
export interface ExamState {
  examId: string;
  status: ExamStatus;
  closeMode: CloseMode;
  openedAt: string | null;
  closedAt: string | null;
  updatedAt: string;
}
export interface SessionInfo { sessionId: string; startedAt: string; participant: Participant }
export interface Submission {
  version: 1;
  submissionCode: string;
  examId: string;
  examTitle: string;
  participant: Participant;
  sessionId: string;
  startedAt: string;
  submittedAt: string;
  durationSeconds: number;
  answeredCount: number;
  answers: Record<string, string>;
  securityEvents: SecurityEvent[];
  userAgent?: string;
}
