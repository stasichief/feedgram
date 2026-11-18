import { XMLParser } from 'fast-xml-parser';
import type { Feed } from './types';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
  processEntities: true,
});

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Exports feeds as an OPML 2.0 document. */
export function exportOPML(feeds: Feed[], title = 'feedgram Subscriptions'): string {
  const outlines = feeds
    .map((feed) => {
      const attrs = [
        `text="${escapeXml(feed.title)}"`,
        `title="${escapeXml(feed.title)}"`,
        `type="rss"`,
        `xmlUrl="${escapeXml(feed.id)}"`,
        feed.siteUrl ? `htmlUrl="${escapeXml(feed.siteUrl)}"` : '',
      ]
        .filter(Boolean)
        .join(' ');

      return `    <outline ${attrs}/>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>${escapeXml(title)}</title>
    <dateCreated>${new Date().toUTCString()}</dateCreated>
  </head>
  <body>
${outlines}
  </body>
</opml>
`;
}

/** Exports saved posts as OPML link outlines; no feed URL is invented for bookmarks. */
export function exportBookmarksOPML(posts: Array<{ title: string; url: string; excerpt?: string }>): string {
  const outlines = posts.filter((post) => post.url).map((post) =>
    `      <outline text="${escapeXml(post.title)}" title="${escapeXml(post.title)}" type="link" htmlUrl="${escapeXml(post.url)}"${post.excerpt ? ` description="${escapeXml(post.excerpt.slice(0, 500))}"` : ''}/>`
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">\n  <head><title>feedgram Bookmarks</title><dateCreated>${new Date().toUTCString()}</dateCreated></head>\n  <body>\n    <outline text="Bookmarks" title="Bookmarks">\n${outlines}\n    </outline>\n  </body>\n</opml>\n`;
}

export interface OPMLImportResult {
  feeds: Array<{
    url: string;
    title: string;
    siteUrl?: string;
  }>;
  errors: string[];
}

/** Parses an OPML document into feed subscriptions. */
export function importOPML(content: string): OPMLImportResult {
  const feeds: OPMLImportResult['feeds'] = [];
  const errors: string[] = [];

  let doc: any;
  try {
    doc = parser.parse(content);
  } catch (error) {
    return {
      feeds,
      errors: [
        `Could not parse OPML: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      ],
    };
  }

  const body = doc?.opml?.body ?? doc?.body;
  if (!body) {
    return { feeds, errors: ['No <body> element found in the OPML file.'] };
  }

  const visit = (node: any) => {
    if (!node) return;
    const outlines = asArray(node.outline);
    for (const outline of outlines) {
      if (!outline || typeof outline !== 'object') continue;

      const xmlUrl =
        outline['@_xmlUrl'] ?? outline['@_xmlurl'] ?? outline['@_xmlURL'];
      const htmlUrl =
        outline['@_htmlUrl'] ?? outline['@_htmlurl'] ?? outline['@_htmlURL'];
      const text = outline['@_text'] ?? outline['@_title'] ?? '';
      const type = outline['@_type'];

      if (xmlUrl && (!type || String(type).toLowerCase().includes('rss'))) {
        feeds.push({
          url: String(xmlUrl),
          title: String(text || htmlUrl || xmlUrl),
          siteUrl: htmlUrl ? String(htmlUrl) : undefined,
        });
      }

      if (outline.outline) visit(outline);
    }
  };

  visit(body);

  if (feeds.length === 0) {
    errors.push('No feeds with an xmlUrl attribute were found.');
  }

  return { feeds, errors };
}

/** Triggers a browser download for the given text content. */
export function downloadTextFile(
  filename: string,
  content: string,
  mimeType = 'text/plain',
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
