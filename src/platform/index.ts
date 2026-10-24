import type { Platform } from './types';
import { webPlatform } from './web';
import { desktopPlatform, KathaBridge } from './desktop';

const bridge = (globalThis as any).kathaDesktop as KathaBridge | undefined;
export const platform: Platform = bridge ? desktopPlatform(bridge) : webPlatform;
export const isDesktop = !!bridge;
export type { Platform };
