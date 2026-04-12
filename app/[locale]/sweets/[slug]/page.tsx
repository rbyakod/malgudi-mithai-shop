import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SweetDetailClient } from "@/components/SweetDetailClient";

type Sweet = {
  slug: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  pricePerUnit: string;
  approxPieces: string;
  shelfLife: string;
  storage: string;
  allergens: string;
  tags: string[];
  image: string;
  thumbnails: string[];
  isBestseller?: boolean;
  isNew?: boolean;
};

const sweets: Sweet[] = [
  {
    slug: "kaju-katli-royale",
    name: "Kaju Katli Royale",
    shortDescription:
      "Silky cashew fudge scented with saffron and cardamom, finished with silver vark.",
    longDescription:
      "Our Kaju Katli Royale reimagines the classic mithai with a smoother texture, higher cashew content, and a gentle balance of saffron and cardamom. Each piece is hand‑cut and finished with premium silver vark, making it perfect for festive gifting, weddings, or that one special box at home.",
    pricePerUnit: "₹699 / 500g",
    approxPieces: "Approx. 18–20 pieces per 500g box.",
    shelfLife: "Best within 7 days of delivery.",
    storage:
      "Store in a cool, dry place away from direct sunlight. Do not refrigerate; texture is best at room temperature.",
    allergens:
      "Contains nuts (cashews). May contain traces of almonds, pistachios, and gluten.",
    tags: ["Dry fruit", "Festive favourite", "Gift box friendly"],
    image: "/images/kaju-katli-hero.jpg",
    thumbnails: [
      "/images/kaju-katli-hero.jpg",
      "/images/kaju-katli-closeup.jpg",
      "/images/kaju-katli-box.jpg",
    ],
    isBestseller: true,
  },
];

type PageParams = {
  slug: string;
};

export async function generateMetadata({
  params,
}: {
  params: PageParams;
}): Promise<Metadata> {
  const sweet = sweets.find((s) => s.slug === params.slug);
  if (!sweet) {
    return {
      title: "Malgudi Sweets",
    };
  }

  return {
    title: `${sweet.name} | Malgudi Sweets`,
    description: sweet.shortDescription,
  };
}

export default function SweetDetailPage({ params }: { params: PageParams }) {
  const sweet = sweets.find((s) => s.slug === params.slug);

  if (!sweet) {
    notFound();
  }

  return <SweetDetailClient sweet={sweet} />;
}
