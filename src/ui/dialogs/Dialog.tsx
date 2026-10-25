import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { store } from '../../app/store';

export function Dialog(props: { title: string; children: ComponentChildren; footer?: ComponentChildren; size?: 'wide' | 'narrow'; onClose?: () => void; floating?: boolean }) {
  const close = props.onClose || (() => store.closeDialog());
  // a dialog never reacts to the tail of the click that opened it
  const mounted = useRef(Date.now());
  const guard = (e: Event) => {
    if (Date.now() - mounted.current < 300) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
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
    <div
      class={props.floating ? 'floatwrap' : 'overlay'}
      onClickCapture={guard}
      onMouseUpCapture={guard}
      onMouseDown={(e) => !props.floating && e.target === e.currentTarget && Date.now() - mounted.current > 300 && close()}
    >
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
