import type { FunctionComponent } from 'preact';

/** Dialogs added by later feature modules register here. */
export const lazyDialogs: Record<string, FunctionComponent<any>> = {};
