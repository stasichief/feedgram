import 'inferno';

/**
 * Inferno ships the global `JSX` namespace with the intrinsic element types,
 * but not with a `JSX.Element` type. Babel performs the actual JSX transform
 * (see `vite.config.ts`), so TypeScript only needs the namespace for
 * type-checking.
 */
declare global {
  namespace JSX {
    type Element = any;
  }
}

export {};
