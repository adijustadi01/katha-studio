import { useEffect, useState } from 'preact/hooks';
import { store } from '../../app/store';
import { prefs } from '../../app/prefs';
import { Dialog } from './Dialog';
import { BUILTIN_TEMPLATES } from '../../core/templates';
import { allCommands, runCommand } from '../../app/commands';
import { keyLabel } from '../MenuBar';
import { schema } from '../../editor/schema';
import { currentElement } from '../../editor/commands';
import { uid } from '../../core/project';
import { platform } from '../../platform';
import type { BackupEntry } from '../../platform/types';
import { userDict, forget, IndicLang } from '../../core/translit';
import { unpackProject } from '../../core/katha-file';
import type { SongData, FightData } from '../../core/types';

export function NewDialog() {
  return (
    <Dialog title="New screenplay">
      <div class="col">
        {[...BUILTIN_TEMPLATES, ...prefs.customTemplates].map((t) => (
          <button
            key={t.id}
            style="text-align:left;padding:10px"
            onClick={() => {
              if (store.project && store.dirty && !confirm('Start a new script? Your current script is autosaved, but not saved to a file.')) return;
              store.closeDialog();
              store.newProject(t.id);
            }}
          >
            <b>{t.name}</b> <span class="muted small">{t.pageWidth}×{t.pageHeight} in</span>
          </button>
        ))}
        <button onClick={() => (store.closeDialog(), runCommand('file.sample'))}>✨ Sample screenplay "Theeram"</button>
      </div>
    </Dialog>
  );
}

export function AboutDialog() {
  return (
    <Dialog title="About Katha Studio" size="narrow">
      <div class="col" style="align-items:center;text-align:center">
        <img src="./icon.svg" style="width:72px" />
        <h2>Katha Studio {platform.appVersion()}</h2>
        <p>Professional screenwriting for Indian film and OTT — with Tamil, Telugu, Hindi, Malayalam and Kannada built in.</p>
        <p class="small muted">Fonts: Courier Prime and Noto (SIL Open Font License). No accounts, no server, no analytics.</p>
      </div>
    </Dialog>
  );
}

export function ShortcutsDialog() {
  const [, force] = useState(0);
  const cmds = allCommands();
  return (
    <Dialog title="Keyboard shortcuts" size="wide">
      <p class="small muted">
        Click a shortcut to change it, then press the new key combination. Editor keys: <kbd>Enter</kbd> next element · <kbd>Tab</kbd> cycle element · <kbd>Shift</kbd>+<kbd>Enter</kbd> line break · <kbd>Ctrl</kbd>+<kbd>Space</kbd> phonetic typing ·
        <kbd>Alt</kbd>+<kbd>1…9</kbd> also set elements in the browser.
      </p>
      <table class="grid">
        <thead>
          <tr>
            <th>Command</th>
            <th>Shortcut</th>
          </tr>
        </thead>
        <tbody>
          {cmds.map((c) => (
            <tr key={c.id}>
              <td>{c.label}</td>
              <td>
                <input
                  readOnly
                  style="width:180px"
                  value={keyLabel(prefs.shortcuts[c.id] || c.keys)}
                  placeholder="—"
                  onKeyDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
                    if (e.key === 'Backspace' || e.key === 'Delete') {
                      delete prefs.shortcuts[c.id];
                    } else {
                      const combo = [e.ctrlKey || e.metaKey ? 'Mod' : '', e.altKey ? 'Alt' : '', e.shiftKey ? 'Shift' : '', e.key.length === 1 ? e.key.toLowerCase() : e.key].filter(Boolean).join('-');
                      prefs.shortcuts[c.id] = combo;
                    }
                    store.savePrefs();
                    force((x) => x + 1);
                  }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Dialog>
  );
}

export function NoteDialog() {
  const [text, setText] = useState('');
  const [color, setColor] = useState(prefs.noteColor);
  const [author, setAuthor] = useState(prefs.author);
  const save = () => {
    const v = store.view!;
    const id = uid('n');
    const { from, to, empty } = v.state.selection;
    const cur = currentElement(v.state);
    store.project!.notes.push({ id, author, color, text, created: Date.now(), elementId: cur?.node.attrs.id });
    prefs.author = author;
    prefs.noteColor = color;
    store.savePrefs();
    if (!empty) v.dispatch(v.state.tr.addMark(from, to, schema.marks.note.create({ id })));
    store.touch();
    store.closeDialog();
  };
  return (
    <Dialog title="Add note" size="narrow" footer={<button class="primary" onClick={save}>Add note</button>}>
      <div class="col">
        <textarea rows={4} autoFocus value={text} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} placeholder="Note for this line / scene…" />
        <div class="row">
          <input value={author} onInput={(e) => setAuthor((e.target as HTMLInputElement).value)} placeholder="Author" />
          {['#ffd54f', '#81d4fa', '#a5d6a7', '#f48fb1', '#ce93d8', '#ffab91'].map((c) => (
            <span key={c} onClick={() => setColor(c)} style={{ width: '22px', height: '22px', borderRadius: '50%', background: c, cursor: 'pointer', outline: color === c ? '2px solid var(--text)' : 'none' }} />
          ))}
        </div>
      </div>
    </Dialog>
  );
}

export function SnapshotDialog() {
  const [name, setName] = useState(`Draft ${store.project!.snapshots.filter((s) => !s.auto).length + 2}`);
  return (
    <Dialog
      title="Save named draft"
      size="narrow"
      footer={
        <button
          class="primary"
          onClick={() => {
            store.snapshot(name);
            store.toast('Draft saved: ' + name, 'ok');
            store.closeDialog();
          }}
        >
          Save draft
        </button>
      }
    >
      <input style="width:100%" autoFocus value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} placeholder='e.g. "Draft 2 – Producer notes"' />
      <p class="small muted">A snapshot of the whole script is stored inside the .katha file. Compare or restore it from Script → Version History.</p>
    </Dialog>
  );
}

export function DictionaryDialog() {
  const [lang, setLang] = useState<IndicLang>('ta');
  const [, force] = useState(0);
  const d = [...userDict(lang).entries()];
  const [word, setWord] = useState('');
  return (
    <Dialog title="Dictionaries" size="narrow">
      <h3>Learned phonetic spellings</h3>
      <div class="row">
        {(['ta', 'te', 'hi', 'ml', 'kn'] as IndicLang[]).map((l) => (
          <button key={l} class={lang === l ? 'on' : ''} onClick={() => setLang(l)}>
            {l.toUpperCase()}
          </button>
        ))}
      </div>
      <table class="grid" style="margin:8px 0">
        <tbody>
          {d.map(([k, v]) => (
            <tr key={k}>
              <td>{k}</td>
              <td>{v}</td>
              <td>
                <button class="ghost" onClick={() => (forget(lang, k), force((x) => x + 1))}>
                  ×
                </button>
              </td>
            </tr>
          ))}
          {!d.length && (
            <tr>
              <td class="muted">Nothing learned yet. When you pick a different suggestion while typing, Katha remembers it.</td>
            </tr>
          )}
        </tbody>
      </table>
      <h3>Custom words (spell check)</h3>
      <p class="small muted">Indian names and words you add here are never marked as misspelled{platform.kind === 'desktop' ? '' : ' (desktop app; in the browser use right-click → Add to dictionary)'}.</p>
      <div class="row">
        <input value={word} onInput={(e) => setWord((e.target as HTMLInputElement).value)} placeholder="e.g. Pulicat" />
        <button
          onClick={() => {
            const w = word.trim();
            if (!w) return;
            prefs.spellWords.push(w);
            platform.addSpellWord?.(w);
            store.savePrefs();
            setWord('');
          }}
        >
          Add
        </button>
      </div>
      <div class="row" style="margin-top:6px">
        {prefs.spellWords.map((w) => (
          <span class="chip" key={w}>
            {w}
          </span>
        ))}
      </div>
    </Dialog>
  );
}

export function BlockDialog({ id }: { id: string }) {
  const el = store.elements().find((e) => e.id === id);
  const [song, setSong] = useState<SongData>({ ...(el?.song || {}) });
  const [fight, setFight] = useState<FightData>({ beats: [''], ...(el?.fight || {}) });
  if (!el) return null;
  const isSong = el.type === 'song';
  const save = () => {
    store.setElementAttrs(id, isSong ? { song } : { fight: { ...fight, beats: (fight.beats || []).filter((b) => b.trim()) } });
    store.closeDialog();
  };
  const sf = (k: keyof SongData, label: string, area = false) => (
    <>
      <label>{label}</label>
      {area ? (
        <textarea rows={2} value={(song as any)[k] || ''} onInput={(e) => setSong({ ...song, [k]: (e.target as HTMLTextAreaElement).value })} />
      ) : (
        <input value={(song as any)[k] ?? ''} onInput={(e) => setSong({ ...song, [k]: k === 'number' ? Number((e.target as HTMLInputElement).value) || undefined : (e.target as HTMLInputElement).value })} />
      )}
    </>
  );
  return (
    <Dialog title={isSong ? '🎵 Song' : '👊 Fight block'} footer={<button class="primary" onClick={save}>Save</button>}>
      {isSong ? (
        <div class="form">
          {sf('number', 'Song number')}
          {sf('title', 'Title')}
          {sf('situation', 'Situation', true)}
          {sf('mood', 'Mood')}
          {sf('singers', 'Singers')}
          {sf('lyricist', 'Lyricist')}
          {sf('choreography', 'Choreography notes', true)}
          {sf('location', 'Location')}
          {sf('duration', 'Duration (m:ss)')}
        </div>
      ) : (
        <div class="form">
          <label>Fight number</label>
          <input value={fight.number ?? ''} onInput={(e) => setFight({ ...fight, number: Number((e.target as HTMLInputElement).value) || undefined })} />
          <label>Setting</label>
          <input value={fight.setting || ''} onInput={(e) => setFight({ ...fight, setting: (e.target as HTMLInputElement).value })} />
          <label>Stunt beats</label>
          <div class="col">
            {(fight.beats || []).map((b, i) => (
              <div class="row" key={i}>
                <b>{i + 1}.</b>
                <input
                  style="flex:1"
                  value={b}
                  onInput={(e) => {
                    const beats = [...(fight.beats || [])];
                    beats[i] = (e.target as HTMLInputElement).value;
                    setFight({ ...fight, beats });
                  }}
                />
                <button class="ghost" onClick={() => setFight({ ...fight, beats: (fight.beats || []).filter((_, j) => j !== i) })}>
                  ×
                </button>
              </div>
            ))}
            <button onClick={() => setFight({ ...fight, beats: [...(fight.beats || []), ''] })}>+ Beat</button>
          </div>
          <label>Key "mass" moment</label>
          <textarea rows={2} value={fight.massMoment || ''} onInput={(e) => setFight({ ...fight, massMoment: (e.target as HTMLTextAreaElement).value })} />
          <label>Duration</label>
          <input value={fight.duration || ''} onInput={(e) => setFight({ ...fight, duration: (e.target as HTMLInputElement).value })} />
        </div>
      )}
      <p class="small muted">The element's own text (typed in the script) holds the description; these details show as a formatted block above it and feed the {isSong ? 'Songs' : 'Fights'} report.</p>
    </Dialog>
  );
}

export function BackupsDialog() {
  const [list, setList] = useState<BackupEntry[]>([]);
  const [all, setAll] = useState(false);
  useEffect(() => {
    platform.listBackups(all || !store.project ? undefined : store.project.id).then(setList);
  }, [all]);
  const restore = async (b: BackupEntry) => {
    const data = await platform.readBackup(b.id);
    if (!data) return store.toast('Backup not readable', 'error');
    const p = await unpackProject(data);
    if (store.project && store.project.id === p.id && !confirm('Replace the open script with this backup? (The current state is backed up first.)')) return;
    if (store.project) await platform.writeBackup(store.project.id, store.fileName, await store.packCurrent());
    store.loadProject(p, null, b.name.replace(/\.katha$/, '') + ' (restored).katha');
    store.dirty = true;
    store.closeDialog();
    store.toast('Backup restored. Save it with File → Save As.', 'ok', 6000);
  };
  return (
    <Dialog title="Backups & recovery" size="wide">
      <div class="row" style="margin-bottom:8px">
        <label>
          <input type="checkbox" checked={all} onChange={() => setAll(!all)} /> Show backups of all scripts
        </label>
        {platform.openBackupFolder && <button onClick={() => platform.openBackupFolder!()}>Open backup folder</button>}
        {store.project && <button onClick={() => store.downloadBackup()}>⬇ Download a backup of the open script</button>}
      </div>
      <table class="grid">
        <thead>
          <tr>
            <th>Script</th>
            <th>Saved</th>
            <th>Type</th>
            <th>Size</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {list.map((b) => (
            <tr key={b.id}>
              <td>{b.name}</td>
              <td>{new Date(b.time).toLocaleString()}</td>
              <td>{b.daily ? 'Daily' : 'Rolling'}</td>
              <td>{Math.round(b.size / 1024)} KB</td>
              <td>
                <button onClick={() => restore(b)}>Restore</button>
              </td>
            </tr>
          ))}
          {!list.length && (
            <tr>
              <td colSpan={5} class="muted">
                No backups yet — they are created automatically while you write.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Dialog>
  );
}
