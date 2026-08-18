// components/reviews/Stars.tsx
// Display-only star row (known-gaps campaign B10) — renders a 1–5 rating
// as filled vs muted glyphs. The interactive star PICKER on the order
// detail page is a form control and stays where it is; this component is
// the read-only counterpart for public review display (PDP today, the
// apps mirror it natively in B11).

type Props = {
  rating: number;
  /** Total scale — always 5 today; prop so fractional heads-up renders stay honest. */
  max?: number;
  /** Visually smaller rows (PDP summary header vs individual reviews). */
  size?: "sm" | "md";
  "aria-label"?: string;
};

export function Stars({rating, max = 5, size = "sm", ...aria}: Props) {
  const filled = Math.max(0, Math.min(Math.round(rating), max));
  return (
    <span
      role="img"
      aria-label={aria["aria-label"] ?? `${filled} out of ${max}`}
      className={`inline-flex items-center font-display leading-none text-gold ${
        size === "md" ? "gap-1 text-lg" : "gap-0.5 text-sm"
      }`}
    >
      {Array.from({length: max}, (_, i) => (
        <span
          key={i}
          className={i < filled ? "text-gold" : "text-text-muted/30"}
          aria-hidden="true"
        >
          ★
        </span>
      ))}
    </span>
  );
}

export default Stars;
