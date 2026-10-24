import { store } from '../app/store';
import { prefs } from '../app/prefs';
import { useStore } from './hooks';
import { todayProgress, streak, lastDays, sprint, startSprint, stopSprint } from '../app/writing';
import { formatMinutes, runtimeMinutes } from '../core/paginate';

export function WritingPanel() {
  const s = useStore();
  const tp = todayProgress();
  const val = prefs.goalType === 'pages' ? tp.pages : tp.words;
  const pct = Math.min(100, Math.round((val / Math.max(1, prefs.goalAmount)) * 100));
  const days = lastDays(14);
  const max = Math.max(prefs.goalAmount, ...days.map((d) => d.value), 1);
  const remain = sprint.running ? Math.max(0, sprint.endsAt - Date.now()) : 0;
  let words = 0;
  s.view?.state.doc.forEach((n) => (words += (n.textContent.match(/\S+/g) || []).length));
  const sessionMin = (Date.now() - s.sessionStart) / 60000;
  return (
    <div class="col">
      <h3>Daily goal</h3>
      <div class="row">
        <input type="number" min={1} style="width:70px" value={prefs.goalAmount} onChange={(e) => ((prefs.goalAmount = Math.max(1, Number((e.target as HTMLInputElement).value))), store.savePrefs())} />
        <select value={prefs.goalType} onChange={(e) => ((prefs.goalType = (e.target as HTMLSelectElement).value as any), store.savePrefs())}>
          <option value="pages">pages / day</option>
          <option value="words">words / day</option>
        </select>
      </div>
      <div style="background:var(--panel2);border-radius:8px;height:14px;overflow:hidden">
        <div style={{ width: pct + '%', height: '100%', background: 'linear-gradient(90deg,#ff7a2f,#d6336c)' }} />
      </div>
      <div class="small">
        Today: <b>{Math.round(val)}</b> / {prefs.goalAmount} {prefs.goalType} · 🔥 streak <b>{streak()}</b> days
      </div>
      <svg viewBox="0 0 280 60" style="width:100%">
        <line x1="0" x2="280" y1={60 - (prefs.goalAmount / max) * 55} y2={60 - (prefs.goalAmount / max) * 55} stroke="#d6336c" stroke-dasharray="3 3" />
        {days.map((d, i) => (
          <rect key={d.date} x={i * 20 + 2} width="16" y={60 - (d.value / max) * 55} height={(d.value / max) * 55} fill={d.value >= prefs.goalAmount ? '#43a047' : '#90a4ae'}>
            <title>
              {d.date}: {Math.round(d.value)}
            </title>
          </rect>
        ))}
      </svg>
      <h3>Sprint timer</h3>
      {sprint.running ? (
        <div class="row">
          <b style="font-size:24px">
            {Math.floor(remain / 60000)}:{String(Math.floor((remain % 60000) / 1000)).padStart(2, '0')}
          </b>
          <button onClick={() => stopSprint(false)}>Stop</button>
        </div>
      ) : (
        <div class="row">
          {[10, 15, 25, 45].map((m) => (
            <button key={m} onClick={() => startSprint(m)}>
              {m} min
            </button>
          ))}
        </div>
      )}
      {sprint.result && <div class="small">{sprint.result}</div>}
      <h3>Session</h3>
      <div class="stat-grid">
        <div class="stat">
          <b>{Math.max(0, words - s.sessionWordsStart)}</b>
          <span>words this session</span>
        </div>
        <div class="stat">
          <b>{formatMinutes(sessionMin)}</b>
          <span>session time</span>
        </div>
        <div class="stat">
          <b>{s.layout?.pages.length || 0}</b>
          <span>pages</span>
        </div>
        <div class="stat">
          <b>{s.layout && s.project ? formatMinutes(runtimeMinutes(s.layout, s.project.settings)) : '—'}</b>
          <span>est. runtime</span>
        </div>
        <div class="stat">
          <b>{Math.round(tp.minutes)}</b>
          <span>active minutes today</span>
        </div>
      </div>
    </div>
  );
}
