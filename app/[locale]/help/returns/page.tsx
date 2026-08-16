// app/[locale]/help/returns/page.tsx
// Returns & refunds — perishability-first policy for mithai plus the
// shelf-stable/merch window. Copy in messages under Legal.returns.
// Indexable.

import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";
import {LegalPage} from "@/components/legal/LegalPage";

type Props = {
  params: Promise<{locale: string}>;
};

export async function generateMetadata({params}: Props): Promise<Metadata> {
  await params;
  const t = await getTranslations("Legal.returns");
  return {title: t("title"), description: t("intro")};
}

export default async function ReturnsPage({params}: Props) {
  // Touch params so the page renders dynamically per locale.
  await params;
  return <LegalPage namespace="returns" />;
}
