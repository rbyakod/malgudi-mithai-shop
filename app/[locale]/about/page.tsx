// app/[locale]/about/page.tsx
// Brand story — copy in messages under Legal.about. Indexable.

import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";
import {LegalPage} from "@/components/legal/LegalPage";

type Props = {
  params: Promise<{locale: string}>;
};

export async function generateMetadata({params}: Props): Promise<Metadata> {
  await params;
  const t = await getTranslations("Legal.about");
  return {title: t("title"), description: t("intro")};
}

export default async function AboutPage({params}: Props) {
  // Touch params so the page renders dynamically per locale.
  await params;
  return <LegalPage namespace="about" />;
}
