import { isTauri } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';

/** True only inside the packaged Tauri WebView; the GitHub Pages build stays web-only. */
export function isNativeApp(): boolean {
  return isTauri();
}

/** Open an authorization URL in the OS browser for native builds, or navigate normally on the web. */
export async function openAuthorizationUrl(url: string): Promise<void> {
  if (isNativeApp()) {
    await openUrl(url);
    return;
  }
  window.location.assign(url);
}

/** Registered private-use callback URI handled by Tauri's deep-link plugin. */
export const NATIVE_OAUTH_REDIRECT_URI = 'app.feedgram.client://oauth/callback';
