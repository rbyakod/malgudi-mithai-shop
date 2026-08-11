// components/InlineScript.tsx
// Wrapper to inject inline `<script>` tags without triggering React 19's
// "Encountered a script tag while rendering React component" dev warning.
//
// React 19 dev-mode fires that warning for ANY `<script>` element rendered
// as JSX with inline content (children or dangerouslySetInnerHTML), even
// with `suppressHydrationWarning`. The warning has no public opt-out.
//
// Workaround: render a `<div>` whose dangerouslySetInnerHTML value CONTAINS
// the script tag as raw HTML. React sees only a `<div>` in its tree → no
// warning. The browser parses the script tag during initial HTML parsing
// (before hydration), so:
//   - text/javascript scripts (e.g. theme init) execute pre-paint (no FOUC)
//   - application/ld+json scripts (JSON-LD) are visible to crawlers
//
// For Server Components only. The wrapper <div> is `display:none` so it
// never affects layout. Crawlers (Google, Bing) accept JSON-LD anywhere
// in the HTML document, not just <head>.

type Props = {
  // The HTML to inject inside the script tag.
  html: string;
  // The real MIME type. Defaults to JSON-LD. Use "text/javascript" for
  // theme-init or similar pre-hydration scripts.
  type?: "application/ld+json" | "text/javascript";
  // Optional id for debugging / duplicate-prevention.
  id?: string;
};

export function InlineScript({html, type = "application/ld+json", id}: Props) {
  const idAttr = id ? ` id="${id}"` : "";
  const scriptTag = `<script${idAttr} type="${type}">${html}</script>`;
  return (
    <div
      style={{display: "none"}}
      dangerouslySetInnerHTML={{__html: scriptTag}}
    />
  );
}
