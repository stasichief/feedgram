/**
 * Mock feed server used by the end-to-end test.
 * Serves RSS, Atom, JSON Feed and article pages with permissive CORS.
 */
import { createServer } from 'node:http';

const PORT = Number(process.env.MOCK_PORT ?? 5199);

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Mock Blog</title>
    <link>http://localhost:${PORT}/</link>
    <description>A mock RSS feed for testing</description>
    <item>
      <title>Understanding the Feed Pipeline</title>
      <link>http://localhost:${PORT}/article/1</link>
      <guid>http://localhost:${PORT}/article/1</guid>
      <pubDate>Mon, 10 Nov 2025 09:00:00 GMT</pubDate>
      <dc:creator>Ada Lovelace</dc:creator>
      <category>engineering</category>
      <comments>7</comments>
      <description><![CDATA[<p>A short summary of the first mock article that describes how feeds are parsed.</p>]]></description>
      <content:encoded><![CDATA[<p>Inline content that should be available without fetching the article.</p>]]></content:encoded>
    </item>
    <item>
      <title>Notes on Offline-First Reading</title>
      <link>http://localhost:${PORT}/article/2</link>
      <guid>http://localhost:${PORT}/article/2</guid>
      <pubDate>Sun, 09 Nov 2025 18:30:00 GMT</pubDate>
      <description>Why caching articles matters for slow connections.</description>
    </item>
    <item>
      <title>Choosing a CORS Proxy</title>
      <link>http://localhost:${PORT}/article/3</link>
      <guid>http://localhost:${PORT}/article/3</guid>
      <pubDate>Sat, 08 Nov 2025 12:00:00 GMT</pubDate>
      <description>Trade-offs between different proxy approaches.</description>
    </item>
  </channel>
</rss>`;

const atom = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Mock Atom Journal</title>
  <link href="http://localhost:${PORT}/atom.xml"/>
  <updated>2025-11-10T10:00:00Z</updated>
  <id>urn:uuid:mock-atom</id>
  <entry>
    <title>Atom Entry One</title>
    <link rel="alternate" type="text/html" href="http://localhost:${PORT}/article/atom-1"/>
    <id>urn:uuid:atom-1</id>
    <updated>2025-11-10T08:00:00Z</updated>
    <published>2025-11-10T08:00:00Z</published>
    <author><name>Grace Hopper</name></author>
    <summary>An Atom entry with a summary.</summary>
    <content type="html">&lt;p&gt;Atom content body.&lt;/p&gt;</content>
  </entry>
  <entry>
    <title>Atom Entry Two</title>
    <link rel="alternate" type="text/html" href="http://localhost:${PORT}/article/atom-2"/>
    <id>urn:uuid:atom-2</id>
    <updated>2025-11-09T08:00:00Z</updated>
    <summary>Second Atom entry.</summary>
  </entry>
</feed>`;

const jsonFeed = JSON.stringify(
  {
    version: 'https://jsonfeed.org/version/1.1',
    title: 'Mock JSON Feed',
    home_page_url: `http://localhost:${PORT}/`,
    items: [
      {
        id: 'json-1',
        url: `http://localhost:${PORT}/article/json-1`,
        title: 'JSON Feed Item One',
        content_html: '<p>HTML content from a JSON feed item.</p>',
        date_published: '2025-11-10T06:00:00Z',
        author: { name: 'Alan Turing' },
      },
      {
        id: 'json-2',
        url: `http://localhost:${PORT}/article/json-2`,
        title: 'JSON Feed Item Two',
        content_text: 'Plain text content from a JSON feed item.',
        date_published: '2025-11-08T06:00:00Z',
      },
    ],
  },
  null,
  2,
);

function article(title, body) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${title}</title></head>
<body>
  <nav><a href="/">Home</a> <a href="/about">About</a></nav>
  <article>
    <h1>${title}</h1>
    <p>${body}</p>
    <p>${body}</p>
    <h2>A section</h2>
    <p>More paragraphs so that Readability considers this a real article rather than a stub, which keeps the extraction heuristics happy and gives the reader something substantial to look at.</p>
    <blockquote>A quoted remark from the article body.</blockquote>
    <pre><code>const answer = 42;</code></pre>
  </article>
  <footer>Footer text</footer>
</body></html>`;
}


const mastodonRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>Tester</title>
  <link>http://localhost:${PORT}/@tester</link>
  <description>Mastodon style feed</description>
  <item>
    <title>Hello from the fediverse</title>
    <link>http://localhost:${PORT}/@tester/101</link>
    <guid>http://localhost:${PORT}/@tester/101</guid>
    <pubDate>Mon, 10 Nov 2025 10:00:00 GMT</pubDate>
    <description>A status posted from a Mastodon-like instance.</description>
  </item>
</channel></rss>`;

const lemmyRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>Lemmy Community</title>
  <link>http://localhost:${PORT}/c/news</link>
  <description>Lemmy style feed</description>
  <item>
    <title>A Lemmy post</title>
    <link>http://localhost:${PORT}/post/201</link>
    <guid>http://localhost:${PORT}/post/201</guid>
    <pubDate>Mon, 10 Nov 2025 11:00:00 GMT</pubDate>
    <description>A post on a Lemmy-like instance.</description>
  </item>
</channel></rss>`;

const mastodonContext = JSON.stringify({
  ancestors: [
    {
      id: '99',
      content: '<p>An ancestor comment.</p>',
      created_at: '2025-11-10T09:00:00.000Z',
      favourites_count: 3,
      account: { acct: 'friend@example.social' },
      replies: [],
    },
  ],
  descendants: [
    {
      id: '102',
      content: '<p>A reply to the status.</p>',
      created_at: '2025-11-10T11:00:00.000Z',
      favourites_count: 5,
      account: { acct: 'stranger@example.social' },
      replies: [
        {
          id: '103',
          content: '<p>A nested reply.</p>',
          created_at: '2025-11-10T12:00:00.000Z',
          favourites_count: 1,
          account: { acct: 'nested@example.social' },
          replies: [],
        },
      ],
    },
  ],
});

const lemmyPost = JSON.stringify({
  // `comment/list` returns a flat list; nesting comes from `comment.path`.
  comments: [
    {
      comment: {
        id: '301',
        content: 'A Lemmy comment.',
        published: '2025-11-10T10:30:00.000Z',
        path: '0.301',
      },
      creator: { name: 'lemmy_user' },
      counts: { score: 7 },
    },
    {
      comment: {
        id: '302',
        content: 'A nested Lemmy reply.',
        published: '2025-11-10T10:45:00.000Z',
        path: '0.301.302',
      },
      creator: { name: 'other_user' },
      counts: { score: 2 },
    },
  ],
});

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://localhost:${PORT}`);
  const path = url.pathname;

  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

  if (request.method === 'OPTIONS') {
    response.writeHead(204).end();
    return;
  }

  const send = (body, type) => {
    response.writeHead(200, { 'Content-Type': type });
    response.end(body);
  };

  switch (path) {
    case '/feed.xml':
      return send(rss, 'application/rss+xml');
    case '/@tester.rss':
      return send(mastodonRss, 'application/rss+xml');
    case '/c/news.rss':
      return send(lemmyRss, 'application/rss+xml');
    case '/api/v1/statuses/101/context':
      return send(mastodonContext, 'application/json');
    case '/api/v3/comment/list':
      return send(lemmyPost, 'application/json');
    case '/atom.xml':
      return send(atom, 'application/atom+xml');
    case '/feed.json':
      return send(jsonFeed, 'application/feed+json');
    case '/article/1':
      return send(
        article(
          'Understanding the Feed Pipeline',
          'This paragraph is part of the extracted article body and should appear in reader mode.',
        ),
        'text/html',
      );
    case '/article/2':
      return send(
        article('Notes on Offline-First Reading', 'Cached articles keep working without a network connection.'),
        'text/html',
      );
    case '/article/3':
      return send(
        article('Choosing a CORS Proxy', 'Any generic proxy URL can be configured.'),
        'text/html',
      );
    case '/article/json-1':
      return send(article('JSON Feed Item One', 'Rendered through the JSON feed pipeline.'), 'text/html');
    case '/':
      return send(
        `<!doctype html><html><head><meta charset="utf-8"><title>Mock Site</title>
         <link rel="alternate" type="application/rss+xml" title="RSS" href="http://localhost:${PORT}/feed.xml">
         </head><body><h1>Mock site</h1></body></html>`,
        'text/html',
      );
    default:
      if (
        path.startsWith('/article/') ||
        path.startsWith('/@tester/') ||
        path.startsWith('/post/')
      ) {
        return send(
          article('Mock Article', 'This mock article exists so that reader mode has something to extract.'),
          'text/html',
        );
      }
      response.writeHead(404, { 'Content-Type': 'text/plain' });
      response.end('not found');
  }
});

server.listen(PORT, () => {
  console.log(`mock feed server on http://localhost:${PORT}`);
});
