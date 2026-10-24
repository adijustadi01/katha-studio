import { useState, useEffect } from 'preact/hooks';
import { command, runCommand } from '../app/commands';
import { store } from '../app/store';
import { t } from '../i18n';
import { useStore } from './hooks';

/** Menu structure shared by the in-app menu bar and the Electron native menu. */
export const MENUS: { label: string; items: (string | '-')[] }[] = [
  {
    label: 'File',
    items: ['file.new', 'file.open', '-', 'file.save', 'file.saveAs', 'file.backup', 'file.backups', '-', 'file.import', 'file.titlePage', '-', 'file.exportPdf', 'file.exportActorPdf', 'file.exportFdx', 'file.exportFountain', 'file.exportDocx', 'file.exportTxt', 'file.exportHtml', '-', 'file.print', 'file.close'],
  },
  { label: 'Edit', items: ['edit.undo', 'edit.redo', '-', 'edit.find', '-', 'edit.bold', 'edit.italic', 'edit.underline', '-', 'edit.note', 'edit.bookmark', 'edit.spellAdd'] },
  {
    label: 'View',
    items: ['view.page', 'view.draft', 'view.speed', '-', 'view.focus', 'view.typewriter', 'view.dark', '-', 'view.zoomIn', 'view.zoomOut', 'view.zoomReset', '-', 'view.roman', 'view.meaning', '-', 'view.sidebar', 'view.rightpanel', '-', 'view.main.script', 'view.main.cards', 'view.main.beats', 'view.main.outline', 'view.main.tracks'],
  },
  {
    label: 'Format',
    items: ['format.scene', 'format.action', 'format.character', 'format.parenthetical', 'format.dialogue', 'format.transition', 'format.shot', 'format.song', 'format.general', 'format.centered', 'format.act', 'format.interval', 'format.fight', 'format.montage', '-', 'format.dual', 'format.undual', 'format.pageBreak', '-', 'format.templates'],
  },
  {
    label: 'Script',
    items: ['script.phonetic.off', 'script.phonetic.ta', 'script.phonetic.te', 'script.phonetic.hi', 'script.phonetic.ml', 'script.phonetic.kn', '-', 'script.toTamil', 'script.toTelugu', 'script.toHindi', 'script.toMalayalam', 'script.toKannada', 'script.toRoman', '-', 'script.sceneNumbers', 'script.lockScenes', 'script.unlockScenes', 'script.omit', '-', 'script.revisions', 'script.snapshot', 'script.versions', '-', 'script.characters', 'script.locations', 'script.notes', 'script.settings'],
  },
  { label: 'Production', items: ['prod.tag', 'prod.sheets', '-', 'prod.oneliner', 'prod.reports', 'prod.songs', 'prod.fights', '-', 'prod.pulse', 'prod.punches', 'prod.stripboard'] },
  { label: 'Tools', items: ['tools.ai', 'tools.writing', 'tools.readAloud', '-', 'view.main.pulse', 'view.main.punches', '-', 'tools.shortcuts', 'tools.settings'] },
  { label: 'Help', items: ['help.manual', 'help.tutorial', '-', 'help.updates', 'help.about'] },
];

export function keyLabel(k?: string): string {
  if (!k) return '';
  const mac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
  return k.replace('Mod', mac ? '⌘' : 'Ctrl').replace(/-/g, '+').replace('++', '+-').replace('Shift', mac ? '⇧' : 'Shift');
}

export function MenuBar() {
  useStore();
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    const close = () => setOpen(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);
  return (
    <div class="menubar" onClick={(e) => e.stopPropagation()}>
      <div class="brand">
        <img src="./icon.svg" alt="" /> Katha Studio
      </div>
      {MENUS.map((m, i) => (
        <div class={'menu' + (open === i ? ' open' : '')} key={m.label}>
          <button onClick={() => setOpen(open === i ? null : i)} onMouseEnter={() => open !== null && setOpen(i)} data-menu={m.label}>
            {t(m.label)}
          </button>
          {open === i && (
            <div class="menu-list">
              {m.items.map((id, j) => {
                if (id === '-') return <div class="menu-sep" key={j} />;
                const c = command(id);
                if (!c) return null;
                const disabled = c.needsProject && !store.project;
                return (
                  <div
                    key={id}
                    class={'menu-item' + (c.checked?.() ? ' checked' : '')}
                    style={disabled ? 'opacity:.4;pointer-events:none' : ''}
                    onClick={() => {
                      setOpen(null);
                      runCommand(id);
                    }}
                  >
                    <span>{c.label}</span>
                    <span class="kbd">{keyLabel(c.keys)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
