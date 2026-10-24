import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import { store } from '../../app/store';

export function Dialog(props: { title: string; children: ComponentChildren; footer?: ComponentChildren; size?: 'wide' | 'narrow'; onClose?: () => void; floating?: boolean }) {
  const close = props.onClose || (() => store.closeDialog());
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, []);
  return (
    <div class={props.floating ? 'floatwrap' : 'overlay'} onMouseDown={(e) => !props.floating && e.target === e.currentTarget && close()}>
      <div class={'dialog ' + (props.size || '')} role="dialog" aria-label={props.title}>
        <header>
          <h2>{props.title}</h2>
          <button class="ghost" onClick={close} aria-label="Close">
            ✕
          </button>
        </header>
        <div class="content">{props.children}</div>
        {props.footer && <footer>{props.footer}</footer>}
      </div>
    </div>
  );
}
