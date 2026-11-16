/**
 * Type declarations for the icon data shipped by the `lucide` package.
 *
 * The package exposes one module per icon; each default-exports the raw SVG
 * node array. They are typed loosely here and narrowed to `IconNode` in
 * `components/common/icons.ts`.
 */
declare module 'lucide/dist/esm/icons/*' {
  const icon: unknown;
  export default icon;
}
