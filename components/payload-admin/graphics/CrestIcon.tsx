import Image from "next/image";

type Props = {
  size?: number;
  className?: string;
};

// Sidebar crest icon. Renders the Mishran crest SVG at a given pixel size.
// Used as admin.components.graphics.Icon.
export function CrestIcon({size = 32, className}: Props) {
  return (
    <Image
      src="/admin/mishran-crest.svg"
      alt=""
      width={size}
      height={size}
      className={className}
      priority
    />
  );
}

CrestIcon.displayName = "CrestIcon";

export default CrestIcon;
