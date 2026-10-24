import { useState } from 'preact/hooks';
import { store } from '../../app/store';
import { prefs } from '../../app/prefs';
import { Dialog } from './Dialog';
import { allTemplates, getTemplate, setCustomTemplates, Template } from '../../core/templates';
import { ELEMENTS } from '../../core/elements';
import { LANGS, LANG_NAMES } from '../../core/types';
import { setUILang, uiLang, UILang } from '../../i18n';
import { platform } from '../../platform';

export function SettingsDialog({ tab: initial }: { tab?: string }) {
  const [tab, setTab] = useState(initial || 'general');
  const p = store.project;
  const [key, setKey] = useState<string>('');
  const [keyLoaded, setKeyLoaded] = useState(false);
  if (!keyLoaded) {
    setKeyLoaded(true);
    platform.getSecret('anthropic').then((k) => setKey(k ? '•'.repeat(12) + k.slice(-4) : ''));
  }
  const setS = (patch: Partial<NonNullable<typeof p>['settings']>) => {
    if (!p) return;
    Object.assign(p.settings, patch);
    store.touch();
    store.computeLayout();
  };
  return (
    <Dialog title="Settings" size="wide" footer={<button class="primary" onClick={() => store.closeDialog()}>Done</button>}>
      <div class="tabs" style="margin:-14px -16px 12px">
        {[
          ['general', 'General'],
          ['script', 'Script'],
          ['language', 'Languages'],
          ['ai', 'AI'],
          ['saving', 'Saving & backups'],
        ].map(([id, l]) => (
          <button key={id} class={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            {l}
          </button>
        ))}
      </div>
      {tab === 'general' && (
        <div class="form">
          <label>Interface language</label>
          <select value={uiLang()} onChange={(e) => (setUILang((e.target as HTMLSelectElement).value as UILang), location.reload())}>
            <option value="en">English</option>
            <option value="ta">தமிழ் (Tamil)</option>
            <option value="te">తెలుగు (Telugu)</option>
          </select>
          <label>Theme</label>
          <select value={prefs.theme} onChange={(e) => ((prefs.theme = (e.target as HTMLSelectElement).value as any), store.savePrefs())}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
          <label>Your name (for notes)</label>
          <input value={prefs.author} onChange={(e) => ((prefs.author = (e.target as HTMLInputElement).value), store.savePrefs())} />
          <label>Typewriter scrolling</label>
          <input type="checkbox" checked={prefs.typewriter} onChange={() => ((prefs.typewriter = !prefs.typewriter), store.savePrefs())} />
        </div>
      )}
      {tab === 'script' && p && (
        <div class="form">
          <label>Page format</label>
          <div class="row">
            <select value={p.settings.template} onChange={(e) => setS({ template: (e.target as HTMLSelectElement).value })}>
              {allTemplates().map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button onClick={() => store.openDialog('templates')}>Edit templates…</button>
          </div>
          <label>Scene numbers</label>
          <select value={p.settings.sceneNumbers} onChange={(e) => setS({ sceneNumbers: (e.target as HTMLSelectElement).value as any })}>
            <option value="none">Off</option>
            <option value="left">Left</option>
            <option value="right">Right</option>
            <option value="both">Left and right</option>
          </select>
          <label>Automatic (CONT'D)</label>
          <input type="checkbox" checked={p.settings.autoContd} onChange={() => setS({ autoContd: !p.settings.autoContd })} />
          <label>(MORE) / (CONT'D) at page breaks</label>
          <input type="checkbox" checked={p.settings.showMoreContd} onChange={() => setS({ showMoreContd: !p.settings.showMoreContd })} />
          <label>"CONTINUED:" headers (shooting script)</label>
          <input type="checkbox" checked={p.settings.continuedHeaders} onChange={() => setS({ continuedHeaders: !p.settings.continuedHeaders })} />
          <label>Minutes per page</label>
          <input type="number" step="0.05" min="0.3" max="3" value={p.settings.screenTimePerPage} onChange={(e) => setS({ screenTimePerPage: Number((e.target as HTMLInputElement).value) || 1 })} />
          <label>Indian-language screen-time calibration</label>
          <div class="col">
            <input type="number" step="0.05" min="0.3" max="3" value={p.settings.indicScreenTimeFactor} onChange={(e) => setS({ indicScreenTimeFactor: Number((e.target as HTMLInputElement).value) || 1 })} />
            <span class="small muted">
              Pages heavy with Tamil/Telugu dialogue take more vertical space. 1.0 = same as English; set e.g. 0.85 if your Indic pages play shorter than one minute each. Calibrate from a shot film: actual minutes ÷ estimated minutes.
            </span>
          </div>
          <label>Pulse Chart gap warning (minutes)</label>
          <input type="number" min="3" max="40" value={p.settings.pulseGapMinutes} onChange={(e) => setS({ pulseGapMinutes: Number((e.target as HTMLInputElement).value) || 12 })} />
        </div>
      )}
      {tab === 'language' && p && (
        <div class="form">
          <label>Default script language</label>
          <select value={p.settings.defaultLang} onChange={(e) => setS({ defaultLang: (e.target as HTMLSelectElement).value as any })}>
            {LANGS.map((l) => (
              <option key={l} value={l}>
                {LANG_NAMES[l]}
              </option>
            ))}
          </select>
          <label>Tamil / Telugu font style</label>
          <select
            value={p.settings.indicFontStyle}
            onChange={(e) => {
              setS({ indicFontStyle: (e.target as HTMLSelectElement).value as any });
              store.initFonts();
            }}
          >
            <option value="sans">Noto Sans (clean)</option>
            <option value="serif">Noto Serif (classic)</option>
          </select>
          <label>Show on screen</label>
          <div class="row">
            <label>
              <input type="checkbox" checked={p.settings.layers.roman} onChange={() => setS({ layers: { ...p.settings.layers, roman: !p.settings.layers.roman } })} /> Roman transliteration
            </label>
            <label>
              <input type="checkbox" checked={p.settings.layers.meaning} onChange={() => setS({ layers: { ...p.settings.layers, meaning: !p.settings.layers.meaning } })} /> English meaning
            </label>
          </div>
          <label>Include in exports</label>
          <div class="row">
            <label>
              <input type="checkbox" checked={p.settings.exportLayers.roman} onChange={() => setS({ exportLayers: { ...p.settings.exportLayers, roman: !p.settings.exportLayers.roman } })} /> Roman transliteration
            </label>
            <label>
              <input type="checkbox" checked={p.settings.exportLayers.meaning} onChange={() => setS({ exportLayers: { ...p.settings.exportLayers, meaning: !p.settings.exportLayers.meaning } })} /> English meaning
            </label>
          </div>
          <label>Phonetic typing</label>
          <div class="small muted">
            Use the language buttons in the toolbar or <kbd>Ctrl</kbd>+<kbd>Space</kbd>. Windows Indic keyboards and Google Input Tools also work — Katha Studio steps aside while an input method is composing.
          </div>
          <label>Learned spellings</label>
          <button onClick={() => store.openDialog('dictionary')}>Open dictionary…</button>
        </div>
      )}
      {tab === 'ai' && (
        <div class="form">
          <label>Anthropic API key</label>
          <div class="col">
            <div class="row">
              <input type="password" style="flex:1" placeholder="sk-ant-…" value={key} onFocus={() => key.startsWith('•') && setKey('')} onInput={(e) => setKey((e.target as HTMLInputElement).value)} />
              <button
                class="primary"
                onClick={async () => {
                  if (!key || key.startsWith('•')) return;
                  await platform.setSecret('anthropic', key.trim());
                  setKey('•'.repeat(12) + key.trim().slice(-4));
                  store.toast('API key saved on this device only.', 'ok');
                  store.emit();
                }}
              >
                Save key
              </button>
              <button
                onClick={async () => {
                  await platform.setSecret('anthropic', null);
                  setKey('');
                  store.emit();
                }}
              >
                Remove
              </button>
            </div>
            <span class="small muted">The key is stored only on this device{platform.kind === 'desktop' ? ' (encrypted with your Windows account)' : ' (in this browser)'}. Script text is sent to Anthropic only when you click an AI action, and you see exactly what is sent first.</span>
          </div>
          <label>Model</label>
          <input value={prefs.aiModel} onChange={(e) => ((prefs.aiModel = (e.target as HTMLInputElement).value.trim() || 'claude-opus-5-5'), store.savePrefs())} />
        </div>
      )}
      {tab === 'saving' && (
        <div class="form">
          <label>Autosave every (seconds)</label>
          <input type="number" min="2" max="120" value={prefs.autosaveSeconds} onChange={(e) => ((prefs.autosaveSeconds = Math.max(2, Number((e.target as HTMLInputElement).value) || 3)), store.savePrefs())} />
          <label>Backups</label>
          <div class="col">
            <span class="small muted">The last 50 versions plus one backup per day are kept automatically{platform.kind === 'desktop' ? ' in your Documents\\Katha Studio Backups folder' : ' in this browser'}.</span>
            <div class="row">
              <button onClick={() => store.openDialog('backups')}>Browse backups…</button>
              {platform.openBackupFolder && <button onClick={() => platform.openBackupFolder!()}>Open backup folder</button>}
              <button onClick={() => store.downloadBackup()}>⬇ Download backup now</button>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}

export function TemplatesDialog() {
  const p = store.project!;
  const [id, setId] = useState(p.settings.template);
  const base = getTemplate(id);
  const [t, setT] = useState<Template>(JSON.parse(JSON.stringify(base)));
  const select = (nid: string) => {
    setId(nid);
    setT(JSON.parse(JSON.stringify(getTemplate(nid))));
  };
  const num = (v: number, f: (n: number) => void, step = 0.05) => <input type="number" step={step} value={v} style="width:80px" onChange={(e) => f(Number((e.target as HTMLInputElement).value))} />;
  const saveAsNew = () => {
    const name = prompt('Template name', t.name + ' (custom)');
    if (!name) return;
    const nt = { ...t, id: 'custom-' + Date.now().toString(36), name, builtin: false };
    prefs.customTemplates.push(nt);
    setCustomTemplates(prefs.customTemplates);
    store.savePrefs();
    select(nt.id);
  };
  const saveExisting = () => {
    const i = prefs.customTemplates.findIndex((x) => x.id === t.id);
    if (i < 0) return saveAsNew();
    prefs.customTemplates[i] = t;
    setCustomTemplates(prefs.customTemplates);
    store.savePrefs();
    store.toast('Template saved', 'ok');
  };
  return (
    <Dialog
      title="Page format & templates"
      size="wide"
      footer={
        <>
          <button onClick={saveAsNew}>Save as new template…</button>
          {!t.builtin && <button onClick={saveExisting}>Save template</button>}
          <button
            class="primary"
            onClick={() => {
              if (!t.builtin) saveExisting();
              p.settings.template = t.builtin ? id : t.id;
              store.touch();
              store.computeLayout();
              store.closeDialog();
            }}
          >
            Use for this script
          </button>
        </>
      }
    >
      <div class="row" style="margin-bottom:10px">
        <select value={id} onChange={(e) => select((e.target as HTMLSelectElement).value)}>
          {allTemplates().map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
              {x.builtin ? '' : ' (custom)'}
            </option>
          ))}
        </select>
        {t.builtin && <span class="small muted">Built-in templates are read-only — save a copy to change them.</span>}
      </div>
      <div class="row small">
        Page {num(t.pageWidth, (n) => setT({ ...t, pageWidth: n }))} × {num(t.pageHeight, (n) => setT({ ...t, pageHeight: n }))} in · Top {num(t.marginTop, (n) => setT({ ...t, marginTop: n }))} · Bottom{' '}
        {num(t.marginBottom, (n) => setT({ ...t, marginBottom: n }))} · Font {num(t.fontSize, (n) => setT({ ...t, fontSize: n }), 0.5)}pt · Line {num(t.lineHeight, (n) => setT({ ...t, lineHeight: n }), 0.5)}pt · Indic line{' '}
        {num(t.indicLineHeight, (n) => setT({ ...t, indicLineHeight: n }), 0.5)}pt
      </div>
      <table class="grid" style="margin-top:10px">
        <thead>
          <tr>
            <th>Element</th>
            <th>Left (in from page edge)</th>
            <th>Width (in)</th>
            <th>Lines before</th>
            <th>Align</th>
            <th>CAPS</th>
            <th>Bold</th>
            <th>Underline</th>
          </tr>
        </thead>
        <tbody>
          {ELEMENTS.map((e) => {
            const s = t.elements[e.type];
            const up = (patch: Partial<typeof s>) => setT({ ...t, elements: { ...t.elements, [e.type]: { ...s, ...patch } } });
            return (
              <tr key={e.type}>
                <td>{e.name}</td>
                <td>{num(s.left, (n) => up({ left: n }))}</td>
                <td>{num(s.width, (n) => up({ width: n }))}</td>
                <td>{num(s.spaceBefore, (n) => up({ spaceBefore: n }), 1)}</td>
                <td>
                  <select value={s.align} onChange={(ev) => up({ align: (ev.target as HTMLSelectElement).value as any })}>
                    <option>left</option>
                    <option>center</option>
                    <option>right</option>
                  </select>
                </td>
                <td>
                  <input type="checkbox" checked={s.uppercase} onChange={() => up({ uppercase: !s.uppercase })} />
                </td>
                <td>
                  <input type="checkbox" checked={!!s.bold} onChange={() => up({ bold: !s.bold })} />
                </td>
                <td>
                  <input type="checkbox" checked={!!s.underline} onChange={() => up({ underline: !s.underline })} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Dialog>
  );
}

export function TitlePageDialog() {
  const p = store.project!;
  const [tp, setTp] = useState({ ...p.titlePage });
  const presets: [string, Partial<typeof tp>][] = [
    ['Standard', { credit: 'Written by' }],
    ['Story, Screenplay & Dialogues', { credit: 'Story, Screenplay & Dialogues by' }],
    ['Screenplay (based on)', { credit: 'Screenplay by', basedOn: 'Based on the novel by ' }],
    ['Teleplay', { credit: 'Teleplay by' }],
  ];
  const f = (k: keyof typeof tp, label: string, area = false) => (
    <>
      <label>{label}</label>
      {area ? (
        <textarea rows={3} value={tp[k]} onInput={(e) => setTp({ ...tp, [k]: (e.target as HTMLTextAreaElement).value })} />
      ) : (
        <input value={tp[k]} onInput={(e) => setTp({ ...tp, [k]: (e.target as HTMLInputElement).value })} />
      )}
    </>
  );
  return (
    <Dialog
      title="Title page"
      footer={
        <button
          class="primary"
          onClick={() => {
            p.titlePage = tp;
            store.touch();
            store.closeDialog();
          }}
        >
          Save
        </button>
      }
    >
      <div class="row" style="margin-bottom:10px">
        <span class="small muted">Templates:</span>
        {presets.map(([n, v]) => (
          <button key={n} class="small" onClick={() => setTp({ ...tp, ...v })}>
            {n}
          </button>
        ))}
      </div>
      <div class="form">
        {f('title', 'Title')}
        {f('credit', 'Credit line')}
        {f('author', 'Writer(s)')}
        {f('basedOn', 'Based on / source')}
        {f('contact', 'Contact', true)}
        {f('draft', 'Draft')}
        {f('date', 'Date')}
        {f('registration', "Registration / copyright (e.g. Writers' Association reg. no.)")}
        {f('notes', 'Notes', true)}
      </div>
    </Dialog>
  );
}
