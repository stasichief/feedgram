const ACTIVE_HOME_TAB_KEY = 'feedgram.activeHomeTab';
const POST_RETURN_CONTEXT_KEY = 'feedgram.postReturnContext';
const RETURN_CONTEXT_MAX_AGE_MS = 30 * 60 * 1000;

export interface PostReturnContext {
  sourceHash: string;
  activeTab: string;
  scrollY: number;
  savedAt: number;
}

export function setActiveHomeTab(tab: string): void {
  try {
    sessionStorage.setItem(ACTIVE_HOME_TAB_KEY, tab);
  } catch {
    // Storage can be unavailable in private browsing or restricted contexts.
  }
}

export function getActiveHomeTab(): string | null {
  try {
    return sessionStorage.getItem(ACTIVE_HOME_TAB_KEY);
  } catch {
    return null;
  }
}

export function savePostReturnContext(
  sourceHash: string,
  activeTab: string,
  scrollY: number,
): void {
  const context: PostReturnContext = {
    sourceHash,
    activeTab,
    scrollY,
    savedAt: Date.now(),
  };

  try {
    sessionStorage.setItem(POST_RETURN_CONTEXT_KEY, JSON.stringify(context));
  } catch {
    // Navigation still works if the browser blocks session storage.
  }
}

export function consumePostReturnContext(
  currentHash: string,
): PostReturnContext | null {
  try {
    const raw = sessionStorage.getItem(POST_RETURN_CONTEXT_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(POST_RETURN_CONTEXT_KEY);

    const value = JSON.parse(raw) as Partial<PostReturnContext>;
    if (
      value.sourceHash !== currentHash ||
      typeof value.activeTab !== 'string' ||
      typeof value.scrollY !== 'number' ||
      typeof value.savedAt !== 'number' ||
      Date.now() - value.savedAt > RETURN_CONTEXT_MAX_AGE_MS
    ) {
      return null;
    }

    return value as PostReturnContext;
  } catch {
    return null;
  }
}
