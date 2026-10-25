import { useState, useEffect, useRef } from 'preact/hooks';
import { command, runCommand } from '../app/commands';
import { store } from '../app/store';
import { t } from '../i18n';
import { useStore } from './hooks';
import { prefs } from '../app/prefs';

export type MenuEntry = string | '-' | { label: string; items: (string | '-')[] };
export interface MenuDef {
  label: string;
  items: MenuEntry[];
}

/** Menu structure shared by the web menu bar and the Electron native menu. */
export const MENUS: MenuDef[] = [
  {
    label: 'File',
    items: [
      'file.new',
      'file.open',
      '-',
      'file.save',
      'file.saveAs',
      'file.backup',
      'file.backups',
      '-',
      'file.import',
      'file.titlePage',
      '-',
      { label: 'Export', items: ['file.exportPdf', 'file.exportActorPdf', '-', 'file.exportFdx', 'file.exportFountain', 'file.exportDocx', 'file.exportTxt', 'file.exportHtml'] },
      'file.print',
      '-',
      'file.close',
    ],
  },
  { label: 'Edit', items: ['edit.undo', 'edit.redo', '-', 'edit.find', '-', 'edit.bold', 'edit.italic', 'edit.underline', '-', 'edit.note', 'edit.highlight', 'edit.bookmark', 'edit.spellAdd'] },
  {
    label: 'View',
    items: [
      'view.page',
      'view.draft',
      'view.speed',
      '-',
      'view.focus',
      'view.typewriter',
      'view.dark',
      '-',
      'view.zoomIn',
      'view.zoomOut',
      'view.zoomReset',
      '-',
      'view.roman',
      'view.meaning',
      '-',
      'view.sidebar',
      'view.rightpanel',
      '-',
      { label: 'Go to View', items: ['view.main.script', 'view.main.cards', 'view.main.beats', 'view.main.outline', 'view.main.tracks', 'view.main.pulse', 'view.main.punches', 'view.main.reports', 'view.main.stripboard'] },
    ],
  },
  {
    label: 'Format',
    items: ['format.scene', 'format.action', 'format.character', 'format.parenthetical', 'format.dialogue', 'format.transition', 'format.shot', 'format.song', 'format.general', 'format.centered', 'format.act', 'format.interval', 'format.fight', 'format.montage', '-', 'format.dual', 'format.undual', 'format.pageBreak', '-', 'format.templates'],
  },
  {
    label: 'Script',
    items: [
      { label: 'Phonetic Typing', items: ['script.phonetic.off', 'script.phonetic.ta', 'script.phonetic.te', 'script.phonetic.hi', 'script.phonetic.ml', 'script.phonetic.kn'] },
      { label: 'Convert Selection', items: ['script.toTamil', 'script.toTelugu', 'script.toHindi', 'script.toMalayalam', 'script.toKannada', '-', 'script.toRoman'] },
      { label: 'Element Language', items: ['script.lang.auto', '-', 'script.lang.en', 'script.lang.ta', 'script.lang.te', 'script.lang.hi', 'script.lang.ml', 'script.lang.kn'] },
      '-',
      'script.sceneNumbers',
      'script.lockScenes',
      'script.unlockScenes',
      'script.omit',
      '-',
      'script.revisions',
      'script.snapshot',
      'script.versions',
      '-',
      'script.characters',
      'script.locations',
      'script.notes',
      'script.settings',
    ],
  },
  { label: 'Production', items: ['prod.tag', 'prod.sheets', '-', 'prod.oneliner', 'prod.reports', 'prod.songs', 'prod.fights', '-', 'prod.pulse', 'prod.punches', 'prod.stripboard'] },
  { label: 'Tools', items: ['tools.ai', 'tools.writing', 'tools.readAloud', '-', 'tools.shortcuts', 'tools.settings'] },
  { label: 'Help', items: ['help.manual', 'help.tutorial', '-', 'help.updates', 'help.about'] },
];

export function keyLabel(k?: string): string {
  if (!k) return '';
  const mac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
  return k.replace('Mod', mac ? '⌘' : 'Ctrl').replace(/-/g, '+').replace('++', '+-').replace('Shift', mac ? '⇧' : 'Shift');
}

const isSub = (e: MenuEntry): e is { label: string; items: (string | '-')[] } => typeof e === 'object';
function enabled(e: MenuEntry): boolean {
  if (e === '-') return false;
  if (isSub(e)) return true;
  const c = command(e);
  return !!c && !(c.needsProject && !store.project);
}

/** Ignore activations this soon after a menu opened (the release of the opening click). */
const OPEN_GUARD_MS = 250;

/**
 * Web/PWA menu bar. Opens on mouse press like a desktop menu bar; items run
 * only on a full click (press AND release on the same item) or Enter, and
 * never within OPEN_GUARD_MS of the menu opening. Pressing anywhere in the bar
 * does not take focus from the script, so the cursor and selection stay put.
 */
export function MenuBar() {
  useStore();
  const [open, setOpen] = useState<number | null>(null);
  const [active, setActive] = useState<number>(-1); // highlighted item in the open menu
  const [sub, setSub] = useState<number>(-1); // index of the open submenu entry
  const [subActive, setSubActive] = useState<number>(-1);
  const [kbTitle, setKbTitle] = useState<number | null>(null); // menu bar focused from the keyboard
  const openedAt = useRef(0);
  const armed = useRef<string | null>(null);
  const subTimer = useRef<any>(null);
  const bar = useRef<HTMLDivElement>(null);
  const altAlone = useRef(false);
  const state = useRef({ open, active, sub, subActive, kbTitle });
  // keep the keyboard-highlighted item visible in a scrolling menu
  useEffect(() => {
    bar.current?.querySelector('.menu.open > .menu-list > .menu-item.active')?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);
  state.current = { open, active, sub, subActive, kbTitle };

  const openMenu = (i: number, highlightFirst = false) => {
    openedAt.current = Date.now();
    armed.current = null;
    setOpen(i);
    setSub(-1);
    setSubActive(-1);
    setActive(highlightFirst ? nextEnabled(MENUS[i].items, -1, 1) : -1);
  };
  const close = (refocus = true) => {
    setOpen(null);
    setSub(-1);
    setActive(-1);
    setSubActive(-1);
    setKbTitle(null);
    armed.current = null;
    if (refocus && store.view && !store.dialog) store.view.focus();
  };
  const activate = (id: string) => {
    close(false);
    // let the menu disappear before the command (dialogs, focus) runs
    setTimeout(() => {
      store.view?.focus();
      void runCommand(id);
    }, 0);
  };

  // close when pressing anywhere outside the bar or its menus
  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (state.current.open === null && state.current.kbTitle === null) return;
      if (bar.current && bar.current.contains(e.target as Node)) return;
      close(false);
    };
    document.addEventListener('mousedown', down, true);
    return () => document.removeEventListener('mousedown', down, true);
  }, []);

  // keyboard: Alt / F10 focus the bar; arrows move; Enter selects; Esc closes
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const st = state.current;
      if (e.key === 'Alt') {
        altAlone.current = e.type === 'keydown' ? !e.repeat : altAlone.current;
        if (e.type === 'keyup' && altAlone.current) {
          altAlone.current = false;
          if (st.open !== null || st.kbTitle !== null) close();
          else setKbTitle(0);
          e.preventDefault();
        }
        return;
      }
      if (e.type !== 'keydown') return;
      altAlone.current = false;
      if (e.key === 'F10' && !e.shiftKey && !e.ctrlKey) {
        e.preventDefault();
        if (st.open !== null || st.kbTitle !== null) close();
        else setKbTitle(0);
        return;
      }
      if (st.open === null && st.kbTitle === null) return;
      const n = MENUS.length;
      const stop = () => {
        e.preventDefault();
        e.stopPropagation();
      };
      if (st.open === null && st.kbTitle !== null) {
        if (e.key === 'ArrowRight') setKbTitle((st.kbTitle + 1) % n);
        else if (e.key === 'ArrowLeft') setKbTitle((st.kbTitle - 1 + n) % n);
        else if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
          openMenu(st.kbTitle, true);
          setKbTitle(null);
        } else if (e.key === 'Escape') close();
        else return;
        stop();
        return;
      }
      const items = MENUS[st.open!].items;
      const inSub = st.sub >= 0 && isSub(items[st.sub]);
      const subItems = inSub ? (items[st.sub] as { items: (string | '-')[] }).items : [];
      switch (e.key) {
        case 'Escape':
          if (inSub) setSub(-1);
          else close();
          break;
        case 'ArrowDown':
          if (inSub) setSubActive(nextEnabled(subItems, st.subActive, 1));
          else setActive(nextEnabled(items, st.active, 1));
          break;
        case 'ArrowUp':
          if (inSub) setSubActive(nextEnabled(subItems, st.subActive, -1));
          else setActive(nextEnabled(items, st.active, -1));
          break;
        case 'ArrowRight':
          if (!inSub && st.active >= 0 && isSub(items[st.active])) {
            setSub(st.active);
            setSubActive(nextEnabled((items[st.active] as any).items, -1, 1));
          } else openMenu((st.open! + 1) % n, true);
          break;
        case 'ArrowLeft':
          if (inSub) setSub(-1);
          else openMenu((st.open! - 1 + n) % n, true);
          break;
        case 'Enter':
        case ' ': {
          if (inSub && st.subActive >= 0) {
            const id = subItems[st.subActive];
            if (id !== '-' && enabled(id)) activate(id);
          } else if (st.active >= 0) {
            const it = items[st.active];
            if (isSub(it)) {
              setSub(st.active);
              setSubActive(nextEnabled(it.items, -1, 1));
            } else if (enabled(it)) activate(it as string);
          }
          break;
        }
        default:
          return;
      }
      stop();
    };
    window.addEventListener('keydown', key, true);
    window.addEventListener('keyup', key, true);
    return () => {
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('keyup', key, true);
    };
  }, []);

  const itemEvents = (id: string) => ({
    onMouseDown: (e: MouseEvent) => {
      e.preventDefault(); // keep focus (and the selection) in the script
      if (e.button === 0) armed.current = id;
    },
    onClick: (e: MouseEvent) => {
      e.stopPropagation();
      // a click needs its press on this same item, after the menu was already open
      if (armed.current !== id || Date.now() - openedAt.current < OPEN_GUARD_MS) return;
      if (!enabled(id)) return;
      activate(id);
    },
  });

  const renderItem = (e: MenuEntry, j: number, isActive: boolean, onHover: () => void, nested = false) => {
    if (e === '-') return <div class="menu-sep" key={'s' + j} />;
    if (isSub(e)) {
      const subOpen = !nested && sub === j;
      return (
        <div
          key={'sub' + j}
          class={'menu-item has-sub' + (isActive || subOpen ? ' active' : '')}
          role="menuitem"
          aria-haspopup="true"
          aria-expanded={subOpen}
          onMouseDown={(ev) => ev.preventDefault()}
          onMouseEnter={() => {
            onHover();
            clearTimeout(subTimer.current);
            setSub(j);
            setSubActive(-1);
          }}
          onClick={(ev) => {
            ev.stopPropagation();
            setSub(j);
          }}
        >
          <span>{t(e.label)}</span>
          <span class="kbd">▸</span>
          {subOpen && (
            <div class="menu-list submenu" role="menu" ref={fitSubmenu} onMouseEnter={() => clearTimeout(subTimer.current)}>
              {e.items.map((x, k) => renderItem(x, k, subActive === k, () => setSubActive(k), true))}
            </div>
          )}
        </div>
      );
    }
    const c = command(e);
    if (!c) return null;
    const dis = c.needsProject && !store.project;
    return (
      <div
        key={e}
        role="menuitem"
        data-cmd={e}
        aria-disabled={dis}
        class={'menu-item' + (c.checked?.() ? ' checked' : '') + (isActive ? ' active' : '') + (dis ? ' disabled' : '')}
        onMouseEnter={() => {
          onHover();
          if (!nested) {
            // leaving a submenu entry closes its submenu after a short delay (hover intent)
            clearTimeout(subTimer.current);
            subTimer.current = setTimeout(() => setSub(-1), 250);
          }
        }}
        {...itemEvents(e)}
      >
        <span>{c.label}</span>
        <span class="kbd">{keyLabel(prefs.shortcuts[e] || c.keys)}</span>
      </div>
    );
  };

  return (
    <div class="menubar" ref={bar} role="menubar" onMouseDown={(e) => e.preventDefault()}>
      <div class="brand">
        <img src="./icon.svg" alt="" /> Katha Studio
      </div>
      {MENUS.map((m, i) => (
        <div class={'menu' + (open === i ? ' open' : '')} key={m.label}>
          <button
            class={kbTitle === i ? 'kb-focus' : ''}
            data-menu={m.label}
            aria-haspopup="true"
            aria-expanded={open === i}
            onMouseDown={(e) => {
              e.preventDefault();
              if (e.button !== 0) return;
              if (open === i) close();
              else openMenu(i);
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseEnter={() => {
              if (open !== null && open !== i) openMenu(i);
            }}
          >
            {t(m.label)}
          </button>
          {open === i && (
            <div class="menu-list" role="menu" ref={fitList}>
              {m.items.map((e, j) => renderItem(e, j, active === j, () => setActive(j)))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * A menu taller than the window scrolls instead of running off the bottom (small or scaled
 * screens). Menus with submenus keep overflow visible so their flyouts are not clipped.
 */
function fitList(el: HTMLDivElement | null) {
  if (!el) return;
  el.style.maxHeight = '';
  el.style.overflowY = '';
  const room = window.innerHeight - el.getBoundingClientRect().top - 6;
  if (el.scrollHeight > room && !el.querySelector('.has-sub')) {
    el.style.maxHeight = Math.max(120, room) + 'px';
    el.style.overflowY = 'auto';
  }
}

/** Keep a submenu inside the window: shift it up near the bottom edge; at the right edge flip it left, or overlap its menu if neither side has room. */
function fitSubmenu(el: HTMLDivElement | null) {
  if (!el) return;
  el.style.top = '';
  el.style.left = '';
  el.style.right = '';
  const r = el.getBoundingClientRect();
  const over = r.bottom - (window.innerHeight - 6);
  if (over > 0) el.style.top = -5 - Math.min(over, r.top - 6) + 'px';
  if (r.right > window.innerWidth - 6) {
    const entry = (el.parentElement as HTMLElement).getBoundingClientRect();
    if (entry.left - r.width >= 6) {
      el.style.left = 'auto';
      el.style.right = '100%';
    } else el.style.left = Math.max(6, window.innerWidth - 6 - r.width) - entry.left + 'px'; // overlap the parent menu
  }
}

function nextEnabled(items: MenuEntry[], from: number, dir: 1 | -1): number {
  const n = items.length;
  for (let k = 1; k <= n; k++) {
    const i = (((from + dir * k) % n) + n) % n;
    if (enabled(items[i])) return i;
  }
  return -1;
}

/** Menu template for the Electron native menu bar. */
export function nativeMenus() {
  const conv = (e: MenuEntry): unknown => {
    if (e === '-') return '-';
    if (isSub(e)) return { label: t(e.label), items: e.items.map(conv) };
    const c = command(e);
    if (!c) return '-';
    return { id: e, label: c.label, keys: prefs.shortcuts[e] || c.keys, checked: c.checked ? c.checked() : undefined, enabled: !(c.needsProject && !store.project) };
  };
  return MENUS.map((m) => {
    const items: unknown[] = m.items.map(conv);
    if (m.label === 'Edit') items.splice(3, 0, '-', { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' });
    if (m.label === 'View') items.push('-', { role: 'togglefullscreen' });
    return { label: t(m.label), items };
  });
}
