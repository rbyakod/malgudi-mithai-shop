import Image from "next/image";

type Props = {
  height?: number;
  className?: string;
};

// Full wordmark for the login page.
// Used as admin.components.graphics.Logo.
export function WordmarkLogo({height = 64, className}: Props) {
  // Aspect ratio 4:1 (wordmark is wider than tall) — width derived from height.
  const width = Math.round(height * 4);
  return (
    <Image
      src="/admin/mishran-wordmark.svg"
      alt="Mishran"
      width={width}
      height={height}
      className={className}
      priority
    />
  );
}

WordmarkLogo.displayName = "WordmarkLogo";

export default WordmarkLogo;
