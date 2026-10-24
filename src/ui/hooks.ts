import { useEffect, useReducer } from 'preact/hooks';
import { store } from '../app/store';

/** Re-render when the store emits. */
export function useStore() {
  const [, force] = useReducer((x: number, _a: void) => x + 1, 0);
  useEffect(() => { const u = store.subscribe(() => force()); return () => { u(); }; }, []);
  return store;
}

/** Re-render on selection changes (status bar, element selector). */
export function useSelection() {
  const [, force] = useReducer((x: number, _a: void) => x + 1, 0);
  useEffect(() => { const u = store.subscribeSel(() => force()); return () => { u(); }; }, []);
  return store;
}
