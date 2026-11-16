import { Readability } from '@mozilla/readability';
import { proxyFetch } from './proxy';
import { getArticle, putArticle } from './db';
import type { Article } from './types';

/** Removes scripts, styles and event handlers from extracted HTML. */
export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return '';

  root.querySelectorAll('script, style, noscript, iframe, object, embed').forEach(
    (node) => node.remove(),
  );

  root.querySelectorAll('*').forEach((node) => {
    for (const attribute of Array.from(node.attributes)) {
      const name = attribute.name.toLowerCase();
      if (name.startsWith('on')) node.removeAttribute(attribute.name);
      if (
        (name === 'href' || name === 'src') &&
        attribute.value.trim().toLowerCase().startsWith('javascript:')
      ) {
        node.removeAttribute(attribute.name);
      }
    }
    if (node.tagName.toLowerCase() === 'a') {
      node.setAttribute('rel', 'noopener noreferrer nofollow');
      node.setAttribute('target', '_blank');
    }
  });

  return root.innerHTML;
}

export interface ExtractionResult {
  title: string;
  html: string;
  text: string;
  byline?: string;
  siteName?: string;
  length: number;
  excerpt?: string;
}

/** Runs Readability over raw HTML. */
export function extractArticle(html: string, _url: string): ExtractionResult | null {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const article = new Readability(doc, {
      charThreshold: 180,
      keepClasses: false,
    }).parse();

    if (!article || !article.content) return null;

    const cleaned = sanitizeHtml(article.content);

    return {
      title: article.title ?? '',
      html: cleaned,
      text: article.textContent ?? '',
      byline: article.byline ?? undefined,
      siteName: article.siteName ?? undefined,
      length: article.length ?? cleaned.length,
      excerpt: article.excerpt ?? undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Fetches and extracts the full article for a post.
 * Cached in IndexedDB so repeated views work offline.
 */
export async function loadArticle(
  postId: string,
  url: string,
  fallbackTitle: string,
): Promise<Article | null> {
  const cached = await getArticle(postId);
  if (cached) return cached;

  const result = await proxyFetch(url);
  if (!result.ok) {
    throw new Error(`Could not fetch article (status ${result.status})`);
  }

  const extracted = extractArticle(result.text, url);
  if (!extracted) return null;

  const article: Article = {
    postId,
    title: extracted.title || fallbackTitle,
    html: extracted.html,
    text: extracted.text,
    byline: extracted.byline,
    siteName: extracted.siteName,
    length: extracted.length,
    excerpt: extracted.excerpt,
    fetchedAt: Date.now(),
  };

  await putArticle(article);
  return article;
}
