import type { Platform } from './types';
import { webPlatform } from './web';
import { desktopPlatform, KathaBridge } from './desktop';

const bridge = (globalThis as any).kathaDesktop as KathaBridge | undefined;
export const platform: Platform = bridge ? desktopPlatform(bridge) : webPlatform;
export const isDesktop = !!bridge;
export type { Platform };

const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
/**
 * Which menu bar to show. The web app and the desktop app on Windows/Linux use
 * the built-in menu bar; macOS keeps its native global menu. On Windows/Linux the
 * system (Electron) menu bar is opt-in: it selects an item when the mouse button is
 * released over it, so a click that moves slightly while opening a menu runs the
 * first item.
 */
export function useBuiltInMenuBar(systemMenuBarPref: boolean): boolean {
  if (!bridge) return true;
  if (isMac) return false;
  return !systemMenuBarPref;
}
