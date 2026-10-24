// Writing goals, streaks, sprint timer and session statistics (stored locally).
import { store } from './store';
import { prefs } from './prefs';

interface Day {
  words: number;
  pages: number;
  minutes: number;
}
interface WritingData {
  days: Record<string, Day>;
}

const KEY = 'katha.writing';
function load(): WritingData {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '') as WritingData;
  } catch {
    return { days: {} };
  }
}
export const writing: WritingData = load();
const today = () => new Date().toISOString().slice(0, 10);
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(writing));
  } catch {
    /* ignore */
  }
}

let lastWords = -1;
let lastPages = -1;
let lastProject = '';
let lastActive = 0;

/** Called after layout updates: counts only growth since the last measurement. */
export function trackProgress() {
  const p = store.project;
  if (!p || !store.layout) return;
  let words = 0;
  store.view?.state.doc.forEach((n) => (words += (n.textContent.match(/\S+/g) || []).length));
  const pages = store.layout.pages.length;
  if (p.id !== lastProject) {
    lastProject = p.id;
    lastWords = words;
    lastPages = pages;
    return;
  }
  const d = (writing.days[today()] ||= { words: 0, pages: 0, minutes: 0 });
  if (words > lastWords) d.words += words - lastWords;
  if (pages > lastPages) d.pages += pages - lastPages;
  const now = Date.now();
  if (lastActive && now - lastActive < 2 * 60 * 1000) d.minutes += (now - lastActive) / 60000;
  lastActive = now;
  lastWords = words;
  lastPages = pages;
  save();
}

export function todayProgress(): Day {
  return writing.days[today()] || { words: 0, pages: 0, minutes: 0 };
}

export function streak(): number {
  let n = 0;
  const d = new Date();
  const goal = prefs.goalAmount;
  for (let i = 0; i < 400; i++) {
    const key = d.toISOString().slice(0, 10);
    const day = writing.days[key];
    const v = day ? (prefs.goalType === 'pages' ? day.pages : day.words) : 0;
    if (v >= goal) n++;
    else if (i > 0) break; // today may still be in progress
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function lastDays(n = 14): { date: string; value: number }[] {
  const out: { date: string; value: number }[] = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    const key = d.toISOString().slice(0, 10);
    const day = writing.days[key];
    out.unshift({ date: key, value: day ? (prefs.goalType === 'pages' ? day.pages : day.words) : 0 });
    d.setDate(d.getDate() - 1);
  }
  return out;
}

// ---- sprint timer
export const sprint = { running: false, endsAt: 0, length: 15, startWords: 0, result: '' as string };
let sprintTimer: any = null;
export function startSprint(minutes: number) {
  sprint.running = true;
  sprint.length = minutes;
  sprint.endsAt = Date.now() + minutes * 60000;
  let w = 0;
  store.view?.state.doc.forEach((n) => (w += (n.textContent.match(/\S+/g) || []).length));
  sprint.startWords = w;
  sprint.result = '';
  clearInterval(sprintTimer);
  sprintTimer = setInterval(() => {
    if (Date.now() >= sprint.endsAt) stopSprint(true);
    store.emit();
  }, 1000);
  store.emit();
}
export function stopSprint(finished = false) {
  clearInterval(sprintTimer);
  if (!sprint.running) return;
  sprint.running = false;
  let w = 0;
  store.view?.state.doc.forEach((n) => (w += (n.textContent.match(/\S+/g) || []).length));
  sprint.result = `${finished ? 'Sprint done! ' : 'Sprint stopped. '}${Math.max(0, w - sprint.startWords)} words written.`;
  if (finished) store.toast('⏱ ' + sprint.result, 'ok', 8000);
  store.emit();
}
