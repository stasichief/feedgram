import { render } from 'inferno';
import { App } from './App';
import { isNativeApp } from './lib/platform';
import './styles/index.css';

const root = document.getElementById('root');

if (root) {
  render(<App />, root);
}

// Register the service worker for offline support.
// `virtual:pwa-register` resolves the correct service worker URL and scope
// for the current build (base path, dev vs. production).
if (import.meta.env.PROD && !isNativeApp()) {
  void import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({ immediate: true });
  });
}
