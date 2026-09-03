import { del, get, list, put } from '@vercel/blob';
import { EXAM_ID } from './exam';
import type { ExamState, Submission } from './types';

const STATUS_PATH = 'config/exam-status.json';
const HISTORY_PATH = 'config/status-history.json';
const defaultState = (): ExamState => ({ examId: EXAM_ID, status: 'OPEN', closeMode: 'STOP_ALL_SUBMISSIONS', openedAt: new Date().toISOString(), closedAt: null, updatedAt: new Date().toISOString() });

async function readJson<T>(pathname: string, fresh = false): Promise<T | null> {
  try {
    const result = await get(pathname, { access: 'private', useCache: !fresh });
    if (!result) return null;
    const text = await new Response(result.stream).text();
    return JSON.parse(text) as T;
  } catch (e: any) {
    if (e?.status === 404 || e?.statusCode === 404 || String(e?.message || '').includes('404')) return null;
    throw e;
  }
}
async function writeJson(pathname: string, value: unknown, overwrite = false) {
  return put(pathname, JSON.stringify(value, null, 2), { access: 'private', contentType: 'application/json; charset=utf-8', allowOverwrite: overwrite });
}
export async function getExamState(fresh = true) { return (await readJson<ExamState>(STATUS_PATH, fresh)) || defaultState(); }
export async function setExamState(status: 'OPEN' | 'CLOSED', closeMode: ExamState['closeMode'] = 'STOP_ALL_SUBMISSIONS') {
  const current = await getExamState(true); const now = new Date().toISOString();
  const next: ExamState = { ...current, status, closeMode, updatedAt: now, openedAt: status === 'OPEN' ? now : current.openedAt, closedAt: status === 'CLOSED' ? now : null };
  await writeJson(STATUS_PATH, next, true);
  const history = (await readJson<any[]>(HISTORY_PATH, true)) || [];
  history.push({ type: status === 'OPEN' ? 'EXAM_OPENED' : 'EXAM_CLOSED', timestamp: now, examId: EXAM_ID, closeMode });
  await writeJson(HISTORY_PATH, history.slice(-500), true);
  return next;
}
export async function getStatusHistory() { return (await readJson<any[]>(HISTORY_PATH, true)) || []; }
export async function saveSubmission(submission: Submission) {
  const path = `submissions/${submission.examId}/${submission.submissionCode}.json`;
  await writeJson(path, submission, false);
  return path;
}
export async function deleteSubmission(path: string) { try { await del(path); } catch {} }
export async function getSubmissions(examId = EXAM_ID): Promise<Submission[]> {
  const out: Submission[] = []; let cursor: string | undefined;
  do {
    const page = await list({ prefix: `submissions/${examId}/`, cursor, limit: 1000 });
    for (const blob of page.blobs) { const item = await readJson<Submission>(blob.pathname, false); if (item) out.push(item); }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out.sort((a,b) => b.submittedAt.localeCompare(a.submittedAt));
}
export async function createBackup() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const [state, history, submissions] = await Promise.all([getExamState(true), getStatusHistory(), getSubmissions()]);
  const payload = { createdAt: new Date().toISOString(), state, history, submissions };
  const path = `backup/backup-${stamp}.json`; await writeJson(path, payload, false); return { path, count: submissions.length };
}
