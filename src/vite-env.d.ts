/// <reference types="vite/client" />

// Vite query-suffix imports — typed so `tsc --noEmit` understands them.
declare module '*?url' {
  const src: string;
  export default src;
}
declare module '*?raw' {
  const content: string;
  export default content;
}
