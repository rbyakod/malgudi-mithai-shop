// lib/api/richText.ts
// Flatten a Lexical rich-text value (what Payload's lexical field stores)
// to a plain string for the mobile v1 contract, whose Product schema types
// `story` as string | null. Scraped-catalog seeds write full Lexical roots;
// the old fixtures wrote plain strings — handle both.

type LexicalNode = {
  text?: string;
  children?: LexicalNode[];
};

type LexicalRoot = {
  root?: { children?: LexicalNode[] };
};

function collectText(node: LexicalNode, out: string[]): void {
  if (typeof node.text === "string") out.push(node.text);
  for (const child of node.children ?? []) collectText(child, out);
}

// Accepts any Payload lexical value and returns plain text, or null when
// there is nothing readable. Paragraph texts are joined with a newline,
// mirroring how the lexical field renders in draft mode.
export function flattenLexical(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value.length ? value : null;
  if (typeof value !== 'object') return null;
  const root = (value as LexicalRoot).root;
  const paragraphs: string[] = [];
  for (const node of root?.children ?? []) {
    const parts: string[] = [];
    collectText(node, parts);
    const line = parts.join('').trim();
    if (line) paragraphs.push(line);
  }
  return paragraphs.length ? paragraphs.join('\n') : null;
}
