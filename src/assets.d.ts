// Files render.ts inlines into the page via `with { type: "text" }` imports.
declare module "*.css" {
  const text: string;
  export default text;
}
declare module "*client.js" {
  const text: string;
  export default text;
}
