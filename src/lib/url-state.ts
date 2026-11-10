/**
 * Query-string state for /compare.
 * Shape: ?a=<modifier-id>&b=<modifier-id>&s=<subject>&v=<view>
 * All fields are optional; defaults are applied at read time.
 */
export type CompareView = 'slider' | 'side-by-side' | 'toggle';
export type CompareSubject = 'glass' | 'apples';

export type CompareState = {
  a: string | null;
  b: string | null;
  subject: CompareSubject;
  view: CompareView;
};

const VIEWS: CompareView[] = ['slider', 'side-by-side', 'toggle'];
const SUBJECTS: CompareSubject[] = ['glass', 'apples'];

export function parseCompareQuery(search: string): CompareState {
  const q = new URLSearchParams(search);
  const subject = q.get('s');
  const view = q.get('v');
  return {
    a: q.get('a'),
    b: q.get('b'),
    subject: (SUBJECTS as string[]).includes(subject ?? '') ? (subject as CompareSubject) : 'glass',
    view: (VIEWS as string[]).includes(view ?? '') ? (view as CompareView) : 'slider',
  };
}

export function serializeCompareQuery(state: Partial<CompareState>): string {
  const q = new URLSearchParams();
  if (state.a) q.set('a', state.a);
  if (state.b) q.set('b', state.b);
  if (state.subject) q.set('s', state.subject);
  if (state.view) q.set('v', state.view);
  const s = q.toString();
  return s ? `?${s}` : '';
}
