import { useEffect, useState } from 'preact/hooks';
import { store } from '../../app/store';
import { prefs } from '../../app/prefs';
import { Dialog } from './Dialog';
import { lazyDialogs } from './lazy';
import { allCharacters, getScenes } from '../../core/scenes';
import { detectLang, hasIndic, characterName } from '../../core/elements';
import { currentElement } from '../../editor/commands';
import { scrollToElement } from '../../editor';
import type { ScriptElement } from '../../core/types';

const LANG_CODES: Record<string, string[]> = { ta: ['ta'], te: ['te'], hi: ['hi'], ml: ['ml'], kn: ['kn'], en: ['en-IN', 'en'] };

function pickVoice(voices: SpeechSynthesisVoice[], name: string | undefined, text: string): SpeechSynthesisVoice | undefined {
  const lang = hasIndic(text) ? detectLang(text) : 'en';
  const named = voices.find((v) => v.name === name);
  // a character's chosen voice is used unless it can't speak the line's language
  if (named && (lang === 'en' || named.lang.toLowerCase().startsWith(lang))) return named;
  for (const code of LANG_CODES[lang]) {
    const v = voices.find((x) => x.lang.toLowerCase().startsWith(code.toLowerCase()));
    if (v) return v;
  }
  return named || voices[0];
}

let playing = false;

function ReadAloudDialog() {
  const p = store.project!;
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [state, setState] = useState<'idle' | 'playing'>(playing ? 'playing' : 'idle');
  const [narrator, setNarrator] = useState<string>((p as any).narratorVoice || '');
  const [readAction, setReadAction] = useState(true);
  useEffect(() => {
    const load = () => setVoices(speechSynthesis.getVoices());
    load();
    speechSynthesis.addEventListener('voiceschanged', load);
    return () => speechSynthesis.removeEventListener('voiceschanged', load);
  }, []);
  const chars = allCharacters(store.elements());
  const indicVoices = voices.filter((v) => /^(ta|te|hi|ml|kn)/i.test(v.lang));

  const play = (scope: 'cursor' | 'scene') => {
    const els = store.elements();
    const st = store.view!.state;
    const cur = currentElement(st);
    let start = cur?.index || 0;
    let end = els.length;
    if (scope === 'scene') {
      const sc = getScenes(els).find((s) => start >= s.start && start < s.end);
      if (sc) {
        start = sc.start;
        end = sc.end;
      }
    }
    const queue: { el: ScriptElement; text: string; voice?: SpeechSynthesisVoice }[] = [];
    let speaker = '';
    for (const e of els.slice(start, end)) {
      if (e.type === 'character') speaker = characterName(e.text);
      if (e.type === 'dialogue' && e.text.trim()) queue.push({ el: e, text: e.text, voice: pickVoice(voices, p.characters[speaker]?.voice, e.text) });
      else if (readAction && (e.type === 'action' || e.type === 'scene') && e.text.trim())
        queue.push({ el: e, text: e.type === 'scene' ? e.text.replace(/^INT\./i, 'Interior.').replace(/^EXT\./i, 'Exterior.') : e.text, voice: pickVoice(voices, narrator, e.text) });
    }
    speechSynthesis.cancel();
    playing = true;
    setState('playing');
    let i = 0;
    const next = () => {
      if (!playing || i >= queue.length) {
        playing = false;
        setState('idle');
        return;
      }
      const q = queue[i++];
      if (store.view) scrollToElement(store.view, q.el.id);
      const u = new SpeechSynthesisUtterance(q.text);
      if (q.voice) {
        u.voice = q.voice;
        u.lang = q.voice.lang;
      }
      u.rate = prefs.speechRate;
      u.onend = next;
      u.onerror = next;
      speechSynthesis.speak(u);
    };
    next();
  };
  const stop = () => {
    playing = false;
    speechSynthesis.cancel();
    setState('idle');
  };
  return (
    <Dialog title="Read aloud" footer={state === 'playing' ? <button onClick={stop}>■ Stop</button> : (
      <>
        <button onClick={() => play('scene')}>▶ Current scene</button>
        <button class="primary" onClick={() => play('cursor')}>▶ From cursor</button>
      </>
    )}>
      {!('speechSynthesis' in window) && <p>Speech is not available on this system.</p>}
      <p class="small muted">
        Uses the voices installed on this computer ({voices.length} found{indicVoices.length ? `, including ${indicVoices.map((v) => v.lang).join(', ')}` : ' — none for Indian languages; on Windows add them under Settings → Time & language → Speech'}). Tamil/Telugu lines automatically use a voice for that language when one exists.
      </p>
      <div class="form">
        <label>Speed</label>
        <input type="range" min="0.5" max="1.8" step="0.1" value={prefs.speechRate} onInput={(e) => ((prefs.speechRate = Number((e.target as HTMLInputElement).value)), store.savePrefs())} />
        <label>Read action & headings</label>
        <input type="checkbox" checked={readAction} onChange={() => setReadAction(!readAction)} />
        <label>Narrator voice</label>
        <select value={narrator} onChange={(e) => (setNarrator((e.target as HTMLSelectElement).value), ((p as any).narratorVoice = (e.target as HTMLSelectElement).value), store.touch())}>
          <option value="">(default)</option>
          {voices.map((v) => (
            <option key={v.name} value={v.name}>
              {v.name} — {v.lang}
            </option>
          ))}
        </select>
        {chars.map((c) => (
          <>
            <label key={c + 'l'}>{c}</label>
            <select
              key={c}
              value={p.characters[c]?.voice || ''}
              onChange={(e) => {
                p.characters[c] = { ...(p.characters[c] || { name: c }), voice: (e.target as HTMLSelectElement).value };
                store.touch();
              }}
            >
              <option value="">(automatic)</option>
              {voices.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name} — {v.lang}
                </option>
              ))}
            </select>
          </>
        ))}
      </div>
    </Dialog>
  );
}

lazyDialogs.readaloud = ReadAloudDialog;
