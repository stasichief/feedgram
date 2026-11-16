import { defineConfig, transformWithEsbuild, type Plugin } from 'vite';
import { transformAsync } from '@babel/core';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Compiles JSX with `babel-plugin-inferno`, which emits Inferno v10's packed
 * vNode flags (newVNode / newComponentVNode). Vite's built-in esbuild JSX
 * transform cannot be used, because it emits React-style calls and does not
 * understand Inferno's flag encoding.
 *
 * Pipeline: esbuild (strip TypeScript, keep JSX) -> babel (JSX -> Inferno vNodes).
 */
function infernoJsx(): Plugin {
  return {
    name: 'feedgram:inferno-jsx',
    enforce: 'pre',
    async transform(code, id) {
      if (!/\.tsx?$/.test(id) || id.includes('node_modules')) return null;

      const loader = id.endsWith('.tsx') ? 'tsx' : 'ts';
      const stripped = await transformWithEsbuild(code, id, {
        loader,
        jsx: 'preserve',
      });

      const result = await transformAsync(stripped.code, {
        filename: id,
        babelrc: false,
        configFile: false,
        sourceMaps: true,
        plugins: [['babel-plugin-inferno', { moduleName: 'inferno' }]],
      });

      if (!result?.code) return null;
      return {
        code: result.code,
        map: result.map ? JSON.parse(JSON.stringify(result.map)) : undefined,
      };
    },
  };
}

/** Keep browser-originated third-party requests same-origin during local dev. */
function devRemoteFetchProxy(): Plugin {
  return {
    name: 'feedgram:dev-remote-fetch-proxy',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__feedgram/proxy', (req, res) => {
        const incoming = req as unknown as {
          method?: string;
          on: (event: string, callback: (chunk?: Uint8Array) => void) => void;
        };
        if (incoming.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }
        const chunks: Uint8Array[] = [];
        incoming.on('data', (chunk) => {
          if (chunk) chunks.push(chunk);
        });
        incoming.on('end', () => {
          void (async () => {
            try {
              const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
              const bytes = new Uint8Array(length);
              let offset = 0;
              for (const chunk of chunks) {
                bytes.set(chunk, offset);
                offset += chunk.length;
              }
              const payload = JSON.parse(new TextDecoder().decode(bytes)) as {
                url: string;
                method?: string;
                headers?: Record<string, string>;
                body?: string | null;
              };
              const target = new URL(payload.url);
              if (!['http:', 'https:'].includes(target.protocol)) {
                throw new Error('Only HTTP(S) URLs are supported');
              }
              const upstream = await fetch(target, {
                method: payload.method ?? 'GET',
                headers: payload.headers,
                body: payload.body ?? undefined,
                redirect: 'follow',
              });
              const text = await upstream.text();
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({
                ok: upstream.ok,
                status: upstream.status,
                text,
                headers: Object.fromEntries(upstream.headers.entries()),
                url: upstream.url,
              }));
            } catch (error) {
              res.statusCode = 502;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({
                error: error instanceof Error ? error.message : 'Remote request failed',
              }));
            }
          })();
        });
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [
    devRemoteFetchProxy(),
    infernoJsx(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: null,
      manifest: {
        name: 'feedgram',
        short_name: 'feedgram',
        description:
          'Offline-first RSS / Atom / JSON Feed reader with a Lemmy-style layout.',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      // React ecosystem libraries that only need createElement / forwardRef
      // work through inferno-compat.
      react: 'inferno-compat',
      'react-dom/test-utils': 'inferno-compat',
      'react-dom': 'inferno-compat',
      'react/jsx-runtime': 'inferno-compat',
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['inferno', 'inferno-router', 'history'],
          parser: ['fast-xml-parser'],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
});
