import { useEffect, useRef, useState } from 'preact/hooks';
import { store } from '../app/store';
import { prefs } from '../app/prefs';
import { useStore } from './hooks';
import { AI_ACTIONS, runAI, scriptForAI, getKey, stripFences, AIRequest } from '../app/ai';
import { currentElement } from '../editor/commands';
import { getScenes } from '../core/scenes';
import { fromFountain } from '../core/formats/fountain';
import { diffScripts } from '../core/diff';
import { setElements, updateSceneMeta } from '../app/scriptops';
import { lazyDialogs } from './dialogs/lazy';
import { Dialog } from './dialogs/Dialog';
import { CompareView } from './dialogs/Revisions';
import type { ScriptElement } from '../core/types';
import { newProject, cloneElements, el } from '../core/project';
import { platform } from '../platform';
import { toDOCX } from '../core/formats/docx';
import { getTemplate } from '../core/templates';

type Scope = 'scene' | 'selection' | 'script';

interface Pending {
  actionId: string;
  scope: Scope;
  start: number;
  end: number;
  original: ScriptElement[];
  requests: AIRequest[];
  target?: string;
}

/** Element index range for a scope. */
function rangeFor(scope: Scope): { start: number; end: number } | null {
  const v = store.view;
  if (!v) return null;
  const els = store.elements();
  if (scope === 'script') return { start: 0, end: els.length };
  const cur = currentElement(v.state);
  if (!cur) return null;
  if (scope === 'selection') {
    const { from, to } = v.state.selection;
    const a = v.state.doc.resolve(from).index(0);
    const b = v.state.doc.resolve(to).index(0);
    return { start: a, end: b + 1 };
  }
  const sc = getScenes(els).find((s) => cur.index >= s.start && cur.index < s.end);
  return sc ? { start: sc.start, end: sc.end } : null;
}

/** Split long scripts into chunks of whole scenes for rewrite actions. */
function chunks(els: ScriptElement[], maxChars = 9000): ScriptElement[][] {
  const scenes = getScenes(els);
  if (!scenes.length) return [els];
  const out: ScriptElement[][] = [];
  let cur: ScriptElement[] = els.slice(0, scenes[0].start);
  let size = cur.reduce((n, e) => n + e.text.length, 0);
  for (const s of scenes) {
    const block = els.slice(s.start, s.end);
    const bs = block.reduce((n, e) => n + e.text.length + 10, 0);
    if (cur.length && size + bs > maxChars) {
      out.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(...block);
    size += bs;
  }
  if (cur.length) out.push(cur);
  return out;
}

const LANGS = ['Tamil', 'Telugu', 'Hindi', 'Malayalam', 'Kannada', 'English'];

export function AIPanel() {
  const s = useStore();
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [actionId, setActionId] = useState('punchup');
  const [scope, setScope] = useState<Scope>('scene');
  const [tone, setTone] = useState('darker and more intense');
  const [lang, setLang] = useState('Telugu');
  const [pending, setPending] = useState<Pending | null>(null);
  const [running, setRunning] = useState<{ done: number; total: number; chars: number } | null>(null);
  const [error, setError] = useState('');
  const [textResult, setTextResult] = useState<{ action: string; text: string; scope: Scope; sceneId?: string } | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => {
    getKey().then((k) => setHasKey(!!k));
  }, [s.version]);
  const action = AI_ACTIONS.find((a) => a.id === actionId)!;
  useEffect(() => {
    if (!action.scope.includes(scope)) setScope(action.scope[0]);
  }, [actionId]);

  if (hasKey === false)
    return (
      <div class="col">
        <h3>✨ AI assistant</h3>
        <p class="small">
          Optional. Uses <b>your own Anthropic API key</b>, stored only on this device. Nothing from your script is sent anywhere until you click an AI action and confirm what will be sent.
        </p>
        <button class="primary" onClick={() => store.openDialog('settings', { tab: 'ai' })}>
          Add API key…
        </button>
        <p class="small muted">Get a key at console.anthropic.com → API keys. Model: {prefs.aiModel}</p>
      </div>
    );

  const prepare = () => {
    setError('');
    setTextResult(null);
    const r = rangeFor(scope);
    if (!r) return setError('Put the cursor inside a scene first.');
    const els = store.elements();
    const original = els.slice(r.start, r.end);
    const target = action.needsTarget === 'tone' ? tone : action.needsTarget === 'lang' ? lang : undefined;
    const title = store.project!.titlePage.title;
    const parts = action.output === 'fountain' && scope === 'script' ? chunks(original) : [original];
    const requests = parts.map((part) => {
      const b = action.build({ script: scriptForAI(part), target, title });
      return { ...b, output: action.output } as AIRequest;
    });
    setPending({ actionId, scope, start: r.start, end: r.end, original, requests, target });
  };

  const send = async () => {
    if (!pending) return;
    const p = pending;
    setPending(null);
    abort.current = new AbortController();
    setRunning({ done: 0, total: p.requests.length, chars: 0 });
    try {
      const outs: string[] = [];
      for (let i = 0; i < p.requests.length; i++) {
        const out = await runAI(p.requests[i], (c) => setRunning({ done: i, total: p.requests.length, chars: c }), abort.current.signal);
        outs.push(stripFences(out));
      }
      setRunning(null);
      if (action.output === 'fountain') {
        const proposed = outs.flatMap((o) => fromFountain(o).elements);
        // keep ids of untouched elements where possible
        store.openDialog('aireview', { ...p, proposed, actionName: action.name });
      } else {
        const sceneId = p.scope === 'scene' ? p.original.find((e) => e.type === 'scene')?.id : undefined;
        setTextResult({ action: p.actionId, text: outs.join('\n\n'), scope: p.scope, sceneId });
      }
    } catch (e) {
      setRunning(null);
      setError((e as Error).message);
    }
  };

  const reqChars = pending ? pending.requests.reduce((n, r) => n + r.system.length + r.user.length, 0) : 0;
  return (
    <div class="col">
      <h3>✨ AI assistant</h3>
      <label class="small">Action</label>
      <select value={actionId} onChange={(e) => setActionId((e.target as HTMLSelectElement).value)}>
        {AI_ACTIONS.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <label class="small">Apply to</label>
      <div class="row">
        {(['scene', 'selection', 'script'] as Scope[]).map((sc) => (
          <button key={sc} class={scope === sc ? 'on' : ''} disabled={!action.scope.includes(sc)} onClick={() => setScope(sc)}>
            {sc === 'scene' ? 'Current scene' : sc === 'selection' ? 'Selection' : 'Whole script'}
          </button>
        ))}
      </div>
      {action.needsTarget === 'tone' && (
        <>
          <label class="small">Tone</label>
          <input value={tone} onInput={(e) => setTone((e.target as HTMLInputElement).value)} placeholder="e.g. comic, emotional, thriller, romantic" />
        </>
      )}
      {action.needsTarget === 'lang' && (
        <>
          <label class="small">Translate dialogue into</label>
          <select value={lang} onChange={(e) => setLang((e.target as HTMLSelectElement).value)}>
            {LANGS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </>
      )}
      {!running && !pending && (
        <button class="primary" onClick={prepare}>
          Preview what will be sent…
        </button>
      )}
      {pending && (
        <div class="col" style="border:2px solid var(--accent);border-radius:8px;padding:8px">
          <b>This text will be sent to Anthropic ({prefs.aiModel}):</b>
          <div class="small muted">
            {pending.requests.length} request(s) · {reqChars.toLocaleString()} characters (~{Math.round(reqChars / 3.5).toLocaleString()} tokens)
          </div>
          <div class="ai-out" style="max-height:220px">
            {pending.requests.map((r, i) => `── request ${i + 1} ──\n[instructions]\n${r.system}\n\n[message]\n${r.user}`).join('\n\n')}
          </div>
          <div class="row">
            <button class="primary" onClick={send}>
              Send
            </button>
            <button onClick={() => setPending(null)}>Cancel</button>
          </div>
        </div>
      )}
      {running && (
        <div class="col">
          <div>
            ⏳ Working… {running.total > 1 ? `part ${running.done + 1} of ${running.total} · ` : ''}
            {running.chars} characters received
          </div>
          <button onClick={() => abort.current?.abort()}>Cancel</button>
        </div>
      )}
      {error && <div style="color:#c62828">{error}</div>}
      {textResult && <TextResult r={textResult} onClose={() => setTextResult(null)} />}
      <p class="small muted">Suggestions never change your script silently: rewrites open as a side-by-side review you accept or reject.</p>
    </div>
  );
}

function TextResult({ r, onClose }: { r: { action: string; text: string; scope: Scope; sceneId?: string }; onClose: () => void }) {
  const exportDoc = async (kind: 'docx' | 'txt') => {
    const title = store.project!.titlePage.title;
    const name = `${title} - ${AI_ACTIONS.find((a) => a.id === r.action)?.name}`;
    if (kind === 'txt') return platform.exportFile(name + '.txt', r.text, 'text/plain');
    const els = r.text.split('\n').map((l) => el(/^SCENE\b/i.test(l) ? 'scene' : 'general', l));
    await platform.exportFile(name + '.docx', await toDOCX(els, getTemplate('indian-a4'), { ...store.project!.titlePage, title: name }), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  };
  return (
    <div class="col">
      <div class="ai-out">{r.text}</div>
      <div class="row">
        <button onClick={() => navigator.clipboard?.writeText(r.text)}>Copy</button>
        <button onClick={() => exportDoc('docx')}>⬇ .docx</button>
        <button onClick={() => exportDoc('txt')}>⬇ .txt</button>
        {r.action === 'summaries' && r.scope === 'scene' && r.sceneId && (
          <button
            onClick={() => {
              updateSceneMeta(r.sceneId!, { synopsis: r.text.replace(/^.*?—\s*/, '').trim() });
              store.toast('Synopsis added to the scene card', 'ok');
            }}
          >
            Use as scene synopsis
          </button>
        )}
        {r.action === 'summaries' && r.scope === 'script' && (
          <button
            onClick={() => {
              const scenes = getScenes(store.elements());
              let n = 0;
              for (const line of r.text.split('\n')) {
                const m = line.match(/^\s*(?:Scene\s*)?([0-9]+[A-Z]?)[.:)]?\s*(?:.*?)\s+[—-]\s+(.+)$/i);
                if (!m) continue;
                const sc = scenes.find((x) => x.number === m[1]);
                if (sc) {
                  updateSceneMeta(sc.id, { synopsis: m[2].trim() });
                  n++;
                }
              }
              store.toast(`${n} scene synopses updated`, 'ok');
            }}
          >
            Apply to scene cards
          </button>
        )}
        <button class="ghost" onClick={onClose}>
          Dismiss
        </button>
      </div>
    </div>
  );
}

/** Merge the proposal onto the originals so unchanged/edited elements keep ids, notes and tags. */
function mergeProposal(rows: ReturnType<typeof diffScripts>): ScriptElement[] {
  const out: ScriptElement[] = [];
  for (const r of rows) {
    if (r.status === 'same') out.push(r.left!);
    else if (r.status === 'changed') {
      const keepSpans = r.left!.text === r.right!.text;
      out.push({ ...r.left!, text: r.right!.text, meaning: r.right!.meaning ?? r.left!.meaning, spans: keepSpans ? r.left!.spans : undefined, roman: undefined });
    } else if (r.status === 'added') out.push(r.right!);
  }
  return out;
}

function AIReviewDialog(d: Pending & { proposed: ScriptElement[]; actionName: string }) {
  const rows = diffScripts(d.original, d.proposed);
  const merged = mergeProposal(rows);
  const isDub = d.actionId === 'dub';
  const accept = () => {
    const els = store.elements();
    // the script may have changed while the AI worked: make sure the range still matches
    const same = els.slice(d.start, d.end).every((e, i) => e.id === d.original[i]?.id);
    if (!same) {
      store.toast('The script changed while the AI was working — re-run the action.', 'error', 6000);
      return;
    }
    if (isDub) store.snapshot(`Before dubbing translation (${d.target})`);
    setElements([...els.slice(0, d.start), ...merged, ...els.slice(d.end)]);
    store.closeDialog();
    store.toast('Changes applied — Ctrl+Z to undo', 'ok');
  };
  const asNewDraft = () => {
    const cur = store.sync();
    const p = newProject();
    Object.assign(p, JSON.parse(JSON.stringify({ ...cur, snapshots: [] })));
    p.id = newProject().id;
    p.elements = cloneElements([...cur.elements.slice(0, d.start), ...merged, ...cur.elements.slice(d.end)]);
    p.titlePage = { ...p.titlePage, draft: `${d.target} dubbing draft` };
    // also keep the translation inside the original project as a named version
    cur.snapshots.push({ id: 'v' + Date.now(), name: `${d.target} dubbing draft`, created: Date.now(), auto: false, elements: cloneElements(p.elements) });
    void store.autosave().then(() => {
      store.closeDialog();
      store.loadProject(p, null, `${store.fileName.replace(/\.katha$/, '')} (${d.target}).katha`);
      store.dirty = true;
      store.toast(`Opened the ${d.target} dubbing draft as a new script. The original is autosaved and has it as a named version.`, 'ok', 7000);
    });
  };
  return (
    <Dialog
      title={`Review AI suggestion — ${d.actionName}`}
      size="wide"
      footer={
        <>
          <button onClick={() => store.closeDialog()}>✕ Reject</button>
          {isDub && (
            <button class="primary" onClick={asNewDraft}>
              Open as new draft
            </button>
          )}
          <button class={isDub ? '' : 'primary'} onClick={accept}>
            ✓ Accept {isDub ? 'into this script' : ''}
          </button>
        </>
      }
    >
      <CompareView rows={rows} />
    </Dialog>
  );
}

lazyDialogs.aireview = AIReviewDialog as any;
