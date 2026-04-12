"use client";

import Image from "next/image";
import {Header} from "@/components/Header";
import {useTranslations} from "next-intl";

const bestSellers = [
  {
    name: "Kaju Katli Royale",
    description:
      "Silky cashew fudge with a whisper of cardamom, finished with vark.",
    price: "₹699 / 500g",
    image: "/images/kaju-katli.jpg"
  },
  {
    name: "Motichoor Laddoo",
    description: "Melt‑in‑mouth boondi laddoos, ghee‑roasted and hand‑rolled.",
    price: "₹549 / 500g",
    image: "/images/motichoor-laddoo.jpg"
  },
  {
    name: "Gulab Jamun Classic",
    description: "Soft khoya dumplings in a warm saffron‑rose syrup.",
    price: "₹499 / 6 pcs",
    image: "/images/gulab-jamun.jpg"
  },
  {
    name: "Festive Assorted Box",
    description: "Curated mix of our signature sweets in a premium gift box.",
    price: "₹1,899 / box",
    image: "/images/assorted-box.jpg"
  }
];

const occasions = [
  {
    name: "Diwali",
    description:
      "Curated hampers for homes and offices, beautifully packed."
  },
  {
    name: "Raksha Bandhan",
    description:
      "Rakhi specials with laddoos, barfis, and keepsake boxes."
  },
  {
    name: "Weddings",
    description:
      "Bespoke mithai boxes for mehendi, sangeet, and reception."
  },
  {
    name: "Corporate gifting",
    description:
      "Branded boxes with pan‑India shipping and bulk pricing."
  }
];

const testimonials = [
  {
    name: "Aditi from Indiranagar",
    quote:
      "We switched all our festival gifting to them — the packaging and taste are consistently premium."
  },
  {
    name: "Rohan, HR Lead",
    quote:
      "Corporate orders were smooth, on time, and beautifully presented. Colleagues still talk about the kaju katli."
  },
  {
    name: "Meera & Arjun",
    quote:
      "Our wedding mithai boxes felt truly special and modern, not like the usual generic sweets."
  }
];

export default function HomePage() {
  const t = useTranslations("Home");

  return (
    <div className="min-h-screen bg-[#fdf7f0] text-[#1b0b07]">
      {/* Background accents */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -left-32 top-0 h-64 w-64 rounded-full bg-[radial-gradient(circle_at_center,_#f6c66a,_transparent_60%)] opacity-70 blur-3xl" />
        <div className="absolute bottom-0 right-[-4rem] h-80 w-80 rounded-full bg-[radial-gradient(circle_at_center,_#b94b4b,_transparent_60%)] opacity-60 blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-16 pt-4 sm:px-6 lg:px-8">
        <Header />

        <main className="flex flex-1 flex-col gap-16">
          {/* Hero */}
          <section
            className="grid items-center gap-10 md:grid-cols-[1.1fr_0.9fr]"
            id="top"
          >
            <div className="space-y-6">
              <p className="inline-block rounded-full bg-[#f7e0c9] px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-[#b94b4b]">
                {t("heroBadge")}
              </p>

              <h1 className="text-4xl font-semibold leading-tight text-[#1b0b07] sm:text-5xl">
                {t("heroTitle")}
              </h1>

              <p className="max-w-xl text-sm leading-relaxed text-[#6b4135] sm:text-base">
                {t("heroSubtitle")}
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <a
                  href="/sweets"
                  className="rounded-full bg-[#b94b4b] px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-[#fdf7f0] shadow-md transition hover:bg-[#a23f3f]"
                >
                  {t("heroPrimaryCta")}
                </a>
                <a
                  href="#gift-boxes"
                  className="rounded-full border border-[#e5cbb2] bg-[#fdf7f0]/70 px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-[#5c372c] transition hover:bg-[#f7e0c9]/60"
                >
                  {t("heroSecondaryCta")}
                </a>
                <p className="text-xs text-[#7a4f42]">
                  {t("heroNote")}
                </p>
              </div>
            </div>

            <div className="relative h-[320px] w-full md:h-[380px]">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#f7e0c9] via-[#fdf7f0] to-[#f0b35c] shadow-xl" />
              <div className="absolute inset-[10px] rounded-3xl bg-[#fdf7f0]/90 backdrop-blur">
                <div className="relative flex h-full flex-col justify-between p-5">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-[#f7e0c9] px-3 py-1 text-xs font-medium text-[#7a4f42]">
                      Diwali 2026 collection
                    </span>
                    <span className="text-xs font-semibold text-[#b94b4b]">
                      New
                    </span>
                  </div>
                  <div className="relative h-40 w-full overflow-hidden rounded-2xl border border-[#f3d2ae] bg-[#fdf7f0]">
                    <Image
                      src="/images/hero-mithai-box.jpg"
                      alt="Assorted Indian sweets in a premium gift box"
                      fill
                      sizes="(min-width: 1024px) 420px, (min-width: 768px) 50vw, 90vw"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[#3b221b]">
                        The Malgudi Festive Box
                      </p>
                      <p className="text-xs text-[#7a4f42]">
                        18‑piece assortment • Custom ribbon & note
                      </p>
                    </div>
                    <a
                      href="/sweets"
                      className="rounded-full bg-[#b94b4b] px-4 py-2 text-xs font-semibold text-[#fdf7f0] shadow-sm hover:bg-[#a23f3f]"
                    >
                      Pre‑order
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Best sellers */}
          <section
            id="menu"
            aria-labelledby="bestsellers-heading"
            className="space-y-6"
          >
            <div className="flex items-baseline justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b94b4b]">
                  {t("bestSellersLabel")}
                </p>
                <h2
                  id="bestsellers-heading"
                  className="mt-1 text-2xl font-semibold text-[#1b0b07]"
                >
                  {t("bestSellersTitle")}
                </h2>
              </div>
              <a
                href="/sweets"
                className="hidden text-xs font-medium text-[#b94b4b] underline-offset-4 hover:underline md:inline"
              >
                View full menu
              </a>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {bestSellers.map((item) => (
            <article
              key={item.name}
              className="group flex flex-col overflow-hidden rounded-2xl border border-[#f0d7bf] bg-[#fefaf5] shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
                  <div className="relative h-32 w-full overflow-hidden bg-[#f7e0c9]">
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 90vw"
                      className="object-cover transition duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <h3 className="text-sm font-semibold text-[#3b221b]">
                      {item.name}
                    </h3>
                    <p className="flex-1 text-xs leading-relaxed text-[#7a4f42]">
                      {item.description}
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-sm font-semibold text-[#b94b4b]">
                        {item.price}
                      </p>
                      <a
                        href="/sweets"
                        className="rounded-full bg-[#1b0b07] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#fdf7f0] transition hover:bg-[#3b221b]"
                      >
                        Order
                      </a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* Occasions */}
          <section
            id="occasions"
            aria-labelledby="occasions-heading"
            className="space-y-6"
          >
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b94b4b]">
                  {t("occasionsLabel")}
                </p>
                <h2
                  id="occasions-heading"
                  className="mt-1 text-2xl font-semibold text-[#1b0b07]"
                >
                  {t("occasionsTitle")}
                </h2>
              </div>
              <p className="max-w-md text-xs text-[#7a4f42]">
                From intimate poojas to thousand‑box corporate hampers, we help
                you plan the perfect mithai for each moment.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {occasions.map((occasion) => (
                <div
                  key={occasion.name}
                  className="flex flex-col gap-2 rounded-2xl border border-[#f0d7bf] bg-[#fefaf5] p-4"
                >
                  <p className="text-sm font-semibold text-[#3b221b]">
                    {occasion.name}
                  </p>
                  <p className="text-xs text-[#7a4f42]">
                    {occasion.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Why people love us */}
          <section
            aria-labelledby="why-heading"
            className="grid gap-10 rounded-3xl bg-[#1b0b07] px-6 py-10 text-[#fdf7f0] md:grid-cols-[1.1fr_0.9fr]"
          >
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f0b35c]">
                {t("whyLabel")}
              </p>
              <h2 id="why-heading" className="text-2xl font-semibold">
                {t("whyTitle")}
              </h2>
              <p className="max-w-md text-sm text-[#f7e0c9]">
                We obsess over ingredients, texture, and packaging so your
                mithai tastes as good as it looks — and arrives fresh, every
                single time.
              </p>

              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-semibold">Fresh, small‑batch mithai</dt>
                  <dd className="text-[#f7e0c9]">
                    Sweets are prepared in limited batches through the week for
                    peak flavour and texture.
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold">Thoughtful packaging</dt>
                  <dd className="text-[#f7e0c9]">
                    Sturdy, elegant boxes that travel beautifully and feel
                    gift‑ready the moment they arrive.
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold">Hygienic kitchens</dt>
                  <dd className="text-[#f7e0c9]">
                    Modern, FSSAI‑certified kitchen with strict hygiene
                    standards and temperature‑controlled storage.
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold">Pan‑city delivery</dt>
                  <dd className="text-[#f7e0c9]">
                    Trusted delivery partners with temperature‑aware packaging
                    across Bengaluru.
                  </dd>
                </div>
              </dl>
            </div>

            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f0b35c]">
                From our customers
              </p>
              <div className="space-y-4">
                {testimonials.map((tst) => (
                  <figure
                    key={tst.name}
                    className="rounded-2xl border border-[#3b221b] bg-[#241210] p-4"
                  >
                    <blockquote className="text-sm text-[#f7e0c9]">
                      “{tst.quote}”
                    </blockquote>
                    <figcaption className="mt-2 text-xs font-semibold text-[#f0b35c]">
                      {tst.name}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </section>

          {/* Corporate */}
          <section
            id="corporate"
            aria-labelledby="corporate-heading"
            className="grid gap-8 md:grid-cols-[1.1fr_0.9fr]"
          >
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b94b4b]">
                {t("corporateLabel")}
              </p>
              <h2
                id="corporate-heading"
                className="text-2xl font-semibold text-[#1b0b07]"
              >
                {t("corporateTitle")}
              </h2>
              <p className="text-sm text-[#6b4135]">
                {t("corporateLead")}
              </p>
              <ul className="list-disc pl-5 text-xs text-[#7a4f42]">
                <li>Custom‑printed sleeves, notes, and logos.</li>
                <li>Curated flavour pairings for different budgets.</li>
                <li>Coordinated delivery across multiple locations.</li>
              </ul>
            </div>

            <div
              id="contact"
              className="rounded-3xl border border-[#f0d7bf] bg-[#fefaf5] p-5 shadow-sm"
            >
              <h3 className="text-sm font-semibold text-[#3b221b]">
                {t("corporateFormTitle")}
              </h3>
              <p className="mt-1 text-xs text-[#7a4f42]">
                {t("corporateFormSubtitle")}
              </p>
              {/* form left as-is for now */}
            </div>
          </section>

          {/* Footer */}
          <footer className="mt-4 border-t border-[#f0d7bf] pt-4 text-xs text-[#7a4f42]">
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <p>
                © {new Date().getFullYear()} Malgudi Sweets. All rights
                reserved.
              </p>
              <div className="flex flex-wrap gap-4">
                <span>{t("footerLocation")}</span>
                <a href="tel:+919876543210" className="hover:text-[#b94b4b]">
                  +91‑98765‑43210
                </a>
                <a href="#" className="hover:text-[#b94b4b]">
                  Instagram
                </a>
                <a href="#" className="hover:text-[#b94b4b]">
                  {t("footerPrivacy")}
                </a>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}