// components/commerce/WhatsAppLink.tsx
// Client island wrapping the CommerceStub's WhatsApp CTA. Fires the
// `whatsapp_clicked` analytics event on click (fire-and-forget — default
// navigation is not blocked). Extracted from CommerceStub because the stub
// is a server component and cannot attach an onClick handler directly.

"use client";

import {type ReactNode} from "react";
import {usePathname} from "@/i18n/navigation";
import {track} from "@/lib/analytics";

type Props = {
  href: string;
  whatsapp: string;
  ctaLabel: string;
  children?: ReactNode;
};

export function WhatsAppLink({href, whatsapp, ctaLabel, children}: Props) {
  const pathname = usePathname();

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track("whatsapp_clicked", {route: pathname})}
      className="group flex flex-col justify-between gap-3 rounded-2xl border border-border-card bg-bg-card p-6 transition-colors hover:border-primary"
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="inline-block h-1.5 w-1.5 rounded-full bg-gold"
        />
        <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-text-muted">
          Talk to us
        </span>
      </div>
      <p className="text-base font-medium text-text-heading">{ctaLabel}</p>
      <p className="text-xs leading-relaxed text-text-muted">{whatsapp}</p>
      {children}
    </a>
  );
}

export default WhatsAppLink;
