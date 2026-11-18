import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Article, AuthSession, Comment, Feed, Post } from './types';

const DB_NAME = 'feedgram';
const DB_VERSION = 1;

interface feedgramDB extends DBSchema {
  feeds: {
    key: string;
    value: Feed;
    indexes: { 'by-addedAt': number };
  };
  posts: {
    key: string;
    value: Post;
    indexes: {
      'by-feedId': string;
      'by-publishedAt': number;
      'by-saved': number;
    };
  };
  articles: {
    key: string;
    value: Article;
  };
  comments: {
    key: string;
    value: Comment;
    indexes: { 'by-postId': string };
  };
  auth: {
    key: string;
    value: AuthSession;
  };
  meta: {
    key: string;
    value: unknown;
  };
}

let dbPromise: Promise<IDBPDatabase<feedgramDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<feedgramDB>> {
  if (!dbPromise) {
    dbPromise = openDB<feedgramDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('feeds')) {
          const feeds = db.createObjectStore('feeds', { keyPath: 'id' });
          feeds.createIndex('by-addedAt', 'addedAt');
        }
        if (!db.objectStoreNames.contains('posts')) {
          const posts = db.createObjectStore('posts', { keyPath: 'id' });
          posts.createIndex('by-feedId', 'feedId');
          posts.createIndex('by-publishedAt', 'publishedAt');
          posts.createIndex('by-saved', 'saved');
        }
        if (!db.objectStoreNames.contains('articles')) {
          db.createObjectStore('articles', { keyPath: 'postId' });
        }
        if (!db.objectStoreNames.contains('comments')) {
          const comments = db.createObjectStore('comments', { keyPath: 'id' });
          comments.createIndex('by-postId', 'postId');
        }
        if (!db.objectStoreNames.contains('auth')) {
          db.createObjectStore('auth', { keyPath: 'method' });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta');
        }
      },
    });
  }
  return dbPromise;
}

/* ------------------------------------------------------------------ feeds */

export async function getAllFeeds(): Promise<Feed[]> {
  const db = await getDB();
  return db.getAll('feeds');
}

export async function putFeed(feed: Feed): Promise<void> {
  const db = await getDB();
  await db.put('feeds', feed);
}

export async function putFeeds(feeds: Feed[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('feeds', 'readwrite');
  await Promise.all(feeds.map((feed) => tx.store.put(feed)));
  await tx.done;
}

export async function deleteFeed(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('feeds', id);
}

export async function getFeed(id: string): Promise<Feed | undefined> {
  const db = await getDB();
  return db.get('feeds', id);
}

/* ------------------------------------------------------------------ posts */

export async function getPostsForFeeds(feedIds: string[]): Promise<Post[]> {
  if (feedIds.length === 0) return [];
  const db = await getDB();
  const tx = db.transaction('posts', 'readonly');
  const results = await Promise.all(
    feedIds.map((feedId) => tx.store.index('by-feedId').getAll(feedId)),
  );
  await tx.done;
  return results.flat();
}

export async function getAllPosts(): Promise<Post[]> {
  const db = await getDB();
  return db.getAll('posts');
}

export async function getPost(id: string): Promise<Post | undefined> {
  const db = await getDB();
  return db.get('posts', id);
}

export async function putPost(post: Post): Promise<void> {
  const db = await getDB();
  await db.put('posts', post);
}

export async function putPosts(posts: Post[]): Promise<void> {
  if (posts.length === 0) return;
  const db = await getDB();
  const tx = db.transaction('posts', 'readwrite');
  await Promise.all(posts.map((post) => tx.store.put(post)));
  await tx.done;
}

export async function updatePost(
  id: string,
  patch: Partial<Post>,
): Promise<void> {
  const db = await getDB();
  const existing = await db.get('posts', id);
  if (!existing) return;
  await db.put('posts', { ...existing, ...patch });
}

export async function deletePostsByFeed(feedId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('posts', 'readwrite');
  const index = tx.store.index('by-feedId');
  for await (const cursor of index.iterate(feedId)) {
    await cursor.delete();
  }
  await tx.done;
}

/**
 * Deletes a feed together with everything derived from it: posts, extracted
 * articles and cached comment threads. Used when unsubscribing or when an
 * explore source is removed with "delete cached posts" selected.
 */
export async function deleteFeedCascade(feedId: string): Promise<void> {
  const db = await getDB();
  const posts = await db.getAllFromIndex('posts', 'by-feedId', feedId);

  const tx = db.transaction(
    ['feeds', 'posts', 'articles', 'comments', 'meta'],
    'readwrite',
  );

  await tx.objectStore('feeds').delete(feedId);

  for (const post of posts) {
    await tx.objectStore('posts').delete(post.id);
    await tx.objectStore('articles').delete(post.id);
    const commentKeys = await tx
      .objectStore('comments')
      .index('by-postId')
      .getAllKeys(post.id);
    for (const key of commentKeys) {
      await tx.objectStore('comments').delete(key);
    }
    await tx.objectStore('meta').delete(`comments:${post.id}:cachedAt`);
  }

  await tx.done;
}

export async function getSavedPosts(): Promise<Post[]> {
  const db = await getDB();
  const all = await db.getAll('posts');
  return all.filter((post) => post.saved);
}

/* --------------------------------------------------------------- articles */

export async function getArticle(postId: string): Promise<Article | undefined> {
  const db = await getDB();
  return db.get('articles', postId);
}

export async function putArticle(article: Article): Promise<void> {
  const db = await getDB();
  await db.put('articles', article);
}

/* --------------------------------------------------------------- comments */

export async function getCommentsForPost(postId: string): Promise<Comment[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('comments', 'by-postId', postId);
  return all.sort((a, b) => a.depth - b.depth);
}

export async function putComments(comments: Comment[]): Promise<void> {
  if (comments.length === 0) return;
  const db = await getDB();
  const tx = db.transaction('comments', 'readwrite');
  await Promise.all(comments.map((comment) => tx.store.put(comment)));
  await tx.done;
}

export async function clearCommentsForPost(postId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('comments', 'readwrite');
  const keys = await tx.store.index('by-postId').getAllKeys(postId);
  await Promise.all(keys.map((key) => tx.store.delete(key)));
  await tx.done;
}

export async function getIndexedStoreSizes(): Promise<Record<'feeds' | 'posts' | 'articles' | 'comments' | 'auth', number>> {
  const db = await getDB();
  const names = ['feeds', 'posts', 'articles', 'comments', 'auth'] as const;
  const sizes = {} as Record<(typeof names)[number], number>;
  for (const name of names) {
    const values = await db.getAll(name as never) as unknown[];
    sizes[name] = values.reduce<number>((sum, value) => sum + new TextEncoder().encode(JSON.stringify(value)).byteLength, 0);
  }
  return sizes;
}

export async function clearIndexedStore(store: 'posts' | 'articles' | 'comments'): Promise<void> {
  const db = await getDB();
  if (store === 'posts') {
    await clearCache();
    return;
  }
  if (store === 'comments') {
    const tx = db.transaction(['comments', 'meta'], 'readwrite');
    await tx.objectStore('comments').clear();
    const keys = await tx.objectStore('meta').getAllKeys();
    await Promise.all(keys.filter((key) => String(key).startsWith('comments:')).map((key) => tx.objectStore('meta').delete(key)));
    await tx.done;
    return;
  }
  await db.clear(store);
}

/** Deletes old unsaved posts with their article/comment records; bookmarks are retained. */
export async function deleteOldPosts(before: number): Promise<number> {
  const db = await getDB();
  const old = (await db.getAll('posts')).filter((post) => !post.saved && post.publishedAt < before);
  const tx = db.transaction(['posts', 'articles', 'comments', 'meta'], 'readwrite');
  for (const post of old) {
    await tx.objectStore('posts').delete(post.id);
    await tx.objectStore('articles').delete(post.id);
    const keys = await tx.objectStore('comments').index('by-postId').getAllKeys(post.id);
    for (const key of keys) await tx.objectStore('comments').delete(key);
    await tx.objectStore('meta').delete(`comments:${post.id}:cachedAt`);
  }
  await tx.done;
  return old.length;
}

/* ------------------------------------------------------------------- auth */

export async function getAuthSessions(): Promise<AuthSession[]> {
  const db = await getDB();
  return db.getAll('auth');
}

export async function putAuthSession(session: AuthSession): Promise<void> {
  const db = await getDB();
  await db.put('auth', session);
}

export async function deleteAuthSession(method: string): Promise<void> {
  const db = await getDB();
  await db.delete('auth', method);
}

/* ------------------------------------------------------------------- meta */

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await getDB();
  return (await db.get('meta', key)) as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await getDB();
  await db.put('meta', value, key);
}

/* ------------------------------------------------------------- utilities */

export async function clearCache(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['posts', 'articles', 'comments', 'meta'], 'readwrite');
  const meta = tx.objectStore('meta');
  const metaKeys = await meta.getAllKeys();
  await Promise.all(metaKeys.filter((key) => String(key).startsWith('comments:')).map((key) => meta.delete(key)));
  await Promise.all([
    tx.objectStore('posts').clear(),
    tx.objectStore('articles').clear(),
    tx.objectStore('comments').clear(),
  ]);
  await tx.done;
}

export async function resetEverything(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    ['feeds', 'posts', 'articles', 'comments', 'auth', 'meta'],
    'readwrite',
  );
  await Promise.all([
    tx.objectStore('feeds').clear(),
    tx.objectStore('posts').clear(),
    tx.objectStore('articles').clear(),
    tx.objectStore('comments').clear(),
    tx.objectStore('auth').clear(),
    tx.objectStore('meta').clear(),
  ]);
  await tx.done;
}

export async function estimateStorage(): Promise<{ usage: number; quota: number }> {
  if (navigator.storage?.estimate) {
    const estimate = await navigator.storage.estimate();
    return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 };
  }
  return { usage: 0, quota: 0 };
}
