import { store } from '../app/store';
import { prefs } from '../app/prefs';
import { runCommand, setTypeCmd, setMode } from '../app/commands';
import { ELEMENTS } from '../core/elements';
import { currentElement } from '../editor/commands';
import { getPhoneticLang, setPhoneticLang } from '../editor/phonetic';
import type { IndicLang } from '../core/translit';
import type { ElementType } from '../core/types';
import { useSelection, useStore } from './hooks';
import { t } from '../i18n';
import { keyLabel } from './MenuBar';
import { DIGIT_SHORTCUTS } from '../core/elements';
import { isDesktop } from '../platform';

const LANG_BUTTONS: [IndicLang | null, string, string][] = [
  [null, 'EN', 'English (phonetic typing off)'],
  ['ta', 'தமிழ்', 'Tamil phonetic typing — type "vanakkam" to get வணக்கம்'],
  ['te', 'తెలుగు', 'Telugu phonetic typing — type "ela unnav" to get ఎలా ఉన్నావ్'],
  ['hi', 'हिं', 'Hindi phonetic typing'],
  ['ml', 'മ', 'Malayalam phonetic typing'],
  ['kn', 'ಕ', 'Kannada phonetic typing'],
];

export function Toolbar() {
  const s = useStore();
  useSelection();
  const st = s.view?.state;
  const cur = st ? currentElement(st) : null;
  const curType = (cur?.node.attrs.type as ElementType) || 'action';
  const ph = getPhoneticLang();
  const saveLabel = s.saving ? t('Saving…') : s.dirty ? t('Unsaved changes') : s.lastSaved ? t('Saved') : s.target ? t('Saved') : 'Not saved to a file yet';
  return (
    <div class="toolbar">
      <select
        class="element-select"
        value={curType}
        title="Element type (Ctrl+1…9)"
        onChange={(e) => setTypeCmd((e.target as HTMLSelectElement).value as ElementType)}
        data-tour="elements"
      >
        {ELEMENTS.map((e) => {
          const i = DIGIT_SHORTCUTS.indexOf(e.type);
          return (
            <option value={e.type} key={e.type}>
              {t(e.name)}
              {i >= 0 ? `   (${keyLabel('Mod-' + (i + 1))})` : ''}
            </option>
          );
        })}
      </select>
      <button class="ghost m-only" title="Scenes" onClick={() => runCommand('view.sidebar')}>
        ☰
      </button>
      <button class="ghost m-only" title="Scene panel (tags, breakdown)" onClick={() => runCommand('view.rightpanel')}>
        🏷
      </button>
      <button class="ghost m-hide" title="Dual dialogue (Ctrl+D)" onClick={() => runCommand('format.dual')}>
        ⫴ Dual
      </button>
      <div class="sep" />
      <div class="lang-switch" title="Phonetic typing language (Ctrl+Space toggles)" data-tour="lang">
        {LANG_BUTTONS.map(([l, label, tip]) => (
          <button
            key={label}
            class={ph === l ? 'on' : ''}
            title={tip}
            onClick={() => {
              setPhoneticLang(l);
              store.emit();
              store.view?.focus();
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div class="sep" />
      <div class="lang-switch m-hide" data-tour="views">
        {(['page', 'draft', 'speed'] as const).map((m) => (
          <button key={m} class={prefs.mode === m ? 'on' : ''} onClick={() => setMode(m)} title={t(m === 'page' ? 'Page View' : m === 'draft' ? 'Draft View' : 'Speed View')}>
            {m === 'page' ? '▤ Page' : m === 'draft' ? '≡ Draft' : '⚡ Speed'}
          </button>
        ))}
      </div>
      <button class={'ghost m-hide' + (prefs.focusMode ? ' on' : '')} title={t('Focus Mode')} onClick={() => runCommand('view.focus')}>
        ◎
      </button>
      <button class="ghost m-hide" title={t('Zoom Out')} onClick={() => runCommand('view.zoomOut')}>
        −
      </button>
      <span class="small muted m-hide">{Math.round(prefs.zoom * 100)}%</span>
      <button class="ghost m-hide" title={t('Zoom In')} onClick={() => runCommand('view.zoomIn')}>
        +
      </button>
      <div class="sep" />
      <select
        value={s.main}
        onChange={(e) => store.setMain((e.target as HTMLSelectElement).value as any)}
        title="Switch view"
        data-tour="mainview"
      >
        <option value="script">📝 Script</option>
        <option value="cards">🗂 {t('Index Cards')}</option>
        <option value="beats">💡 {t('Beat Board')}</option>
        <option value="outline">🧭 {t('Outline')}</option>
        <option value="tracks">🧵 {t('Story Tracks')}</option>
        <option value="pulse">📈 {t('Pulse Chart')}</option>
        <option value="punches">🥊 {t('Punch Library')}</option>
        <option value="reports">📊 {t('Reports')}</option>
        <option value="stripboard">🎬 {t('Stripboard')}</option>
      </select>
      {s.project?.revision.active && (
        <span class="chip" style="background:#fff3e0;border-color:#ff9800;color:#e65100" title="Revision mode is on — changes are marked">
          ✱ {s.project.revision.label}
        </span>
      )}
      <div class="spacer" />
      <div class={'save-state' + (s.dirty ? ' dirty' : '')} title={s.target ? 'Autosaves to ' + s.fileName : 'Autosaved to this device. Use Save to choose a file.'}>
        <span class="dot" />
        {saveLabel}
      </div>
      <button class="ghost" title="Save (Ctrl+S)" onClick={() => runCommand('file.save')}>
        💾
      </button>
      {!isDesktop && (
        <button class="ghost" title="Download a backup copy of this script (.katha) — do this regularly in the browser" onClick={() => runCommand('file.backup')}>
          ⬇ Backup
        </button>
      )}
      <button class="ghost" title="Export PDF" onClick={() => runCommand('file.exportPdf')}>
        PDF
      </button>
      <button class={'ghost' + (prefs.rightPanel === 'ai' ? ' on' : '')} title="AI Assistant" onClick={() => runCommand('tools.ai')} data-tour="ai">
        ✨ AI
      </button>
    </div>
  );
}
