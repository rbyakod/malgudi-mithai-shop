// components/InlineScript.tsx
// Next.js-recommended wrapper for inline `<script>` tags that suppresses the
// React 19 warning "Encountered a script tag while rendering React component.
// Scripts inside React components are never executed when rendering on the
// client. Consider using template tag instead."
//
// Pattern source: Next.js docs > Guides > Preventing flash before hydration
// (https://nextjs.org/docs/app/guides/preventing-flash-before-hydration)
//
// How it works:
// - On the server (typeof window === 'undefined'), type is the real MIME
//   (`text/javascript` for theme init, `application/ld+json` for JSON-LD).
// - On the client, type becomes `text/plain`, which browsers refuse to
//   execute. The script is in the HTML payload once — server-rendered —
//   so it ran before hydration and is inert from then on.
// - `suppressHydrationWarning` silences the attribute-diff warning that
//   would otherwise fire because the type attr differs between server
//   and client HTML.
//
// Use this for:
// - JSON-LD structured data (data-only, never executes; type application/ld+json)
// - Theme init / FOUC-prevention scripts (must run before paint; type text/javascript)
//
// Do NOT use this for analytics bootstrap (use next/script instead —
// analytics scripts need to actually execute on client navigation, which
// the type-toggle here prevents).

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
  return (
    <script
      id={id}
      type={typeof window === "undefined" ? type : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{__html: html}}
    />
  );
}
