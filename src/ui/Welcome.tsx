import { useEffect, useState } from 'preact/hooks';
import { store } from '../app/store';
import { runCommand, openFileFlow } from '../app/commands';
import { platform } from '../platform';
import type { RecentEntry, RecoveryEntry } from '../platform/types';
import { BUILTIN_TEMPLATES } from '../core/templates';
import { prefs } from '../app/prefs';
import { t, setUILang, uiLang, UILang } from '../i18n';

const TPL_DESC: Record<string, string> = {
  'indian-a4': 'A4, Courier Prime 12pt — the default for Indian film & OTT',
  'hollywood-letter': 'US Letter, industry-standard margins',
  'tv-one-hour': 'Act breaks for one-hour drama',
  'tv-half-hour': 'Multicam sitcom style',
  'stage-play': 'Theatre format',
};

export function Welcome() {
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const [recovery, setRecovery] = useState<RecoveryEntry[]>([]);
  useEffect(() => {
    platform.recent().then(setRecent);
    platform.listRecovery().then((r) => setRecovery(r.sort((a, b) => b.time - a.time)));
  }, []);
  const openRecent = async (r: RecentEntry) => {
    if (r.path && platform.readPath) {
      const f = await platform.readPath(r.path);
      if (f) return store.openData(f.name, f.data, { name: f.name, path: f.path });
      store.toast('File not found: ' + r.path, 'error');
    }
    if (r.projectId) {
      const rec = recovery.find((x) => x.projectId === r.projectId);
      if (rec) return store.recoverProject(r.projectId);
    }
    store.toast('That file is no longer available. Use Open… to locate it.', 'error');
  };
  return (
    <div class="welcome">
      <div class="welcome-inner">
        <div class="row" style="justify-content:space-between">
          <div>
            <h1>
              {t('Welcome')} to <span>Katha Studio</span>
            </h1>
            <div class="tag">Screenwriting for Indian cinema — தமிழ் · తెలుగు · हिन्दी · മലയാളം · ಕನ್ನಡ · English</div>
          </div>
          <div class="row">
            <select value={uiLang()} onChange={(e) => (setUILang((e.target as HTMLSelectElement).value as UILang), location.reload())} title={t('Interface language')}>
              <option value="en">English UI</option>
              <option value="ta">தமிழ் UI</option>
              <option value="te">తెలుగు UI</option>
            </select>
            <button onClick={() => runCommand('view.dark')}>{prefs.theme === 'dark' ? '☀' : '☾'}</button>
          </div>
        </div>
        {recovery.some((r) => r.unsaved) && (
          <div class="recent" style="border:1px solid #ff9800;margin-bottom:20px">
            <h3 style="color:#ffb74d">⚠ Unsaved work found — recover it</h3>
            {recovery
              .filter((r) => r.unsaved)
              .map((r) => (
                <div class="recent-item" key={r.projectId} onClick={() => store.recoverProject(r.projectId)}>
                  <span>
                    <b>{r.name}</b> <span class="small" style="color:#cfc6e0">autosaved {new Date(r.time).toLocaleString()}</span>
                  </span>
                  <button class="primary">Recover</button>
                </div>
              ))}
          </div>
        )}
        <div class="welcome-grid">
          <div>
            <h3>Start writing</h3>
            <div class="tpl-grid">
              <button class="tpl feature" onClick={() => runCommand('file.sample')} data-tour="sample">
                <b>✨ {t('Open sample screenplay')}</b>
                <span>"Theeram" — Tamil + Telugu, song, interval, fight block</span>
              </button>
              {BUILTIN_TEMPLATES.map((tp) => (
                <button class="tpl" key={tp.id} onClick={() => store.newProject(tp.id)}>
                  <b>{tp.name}</b>
                  <span>{TPL_DESC[tp.id]}</span>
                </button>
              ))}
              {prefs.customTemplates.map((tp) => (
                <button class="tpl" key={tp.id} onClick={() => store.newProject(tp.id)}>
                  <b>{tp.name}</b>
                  <span>Your template</span>
                </button>
              ))}
            </div>
            <div class="row" style="margin-top:18px">
              <button class="primary" onClick={() => openFileFlow()}>
                📂 {t('Open…')} (.katha, .fdx, .fountain, .docx, .txt)
              </button>
              <button onClick={() => runCommand('help.manual')}>📖 {t('User Manual')}</button>
              <button onClick={() => runCommand('help.tutorial')}>🎓 {t('Tutorial')}</button>
              <button onClick={() => runCommand('file.backups')}>🛟 Backups</button>
            </div>
          </div>
          <div class="recent">
            <h3>{t('Recent files')}</h3>
            {!recent.length && <div style="color:#cfc6e0">Nothing yet. Your scripts stay on this computer — no accounts, no cloud.</div>}
            {recent.map((r) => (
              <div class="recent-item" key={(r.path || r.projectId || "") + r.time} onClick={() => openRecent(r)}>
                <span>
                  <b>{r.name}</b>
                  <br />
                  <span class="small" style="color:#cfc6e0">{r.path || 'Saved in this browser'}</span>
                </span>
                <span class="small" style="color:#cfc6e0">{new Date(r.time).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
        <p class="small" style="color:#9d93b3;margin-top:40px">
          Privacy: Katha Studio has no accounts, no server and no analytics. Your scripts never leave this computer unless you run an AI action with your own API key.
        </p>
      </div>
    </div>
  );
}
