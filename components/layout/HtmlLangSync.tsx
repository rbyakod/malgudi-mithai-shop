"use client";
// Keeps <html lang> in sync with the active locale across client-side
// navigations. The root layout (app/layout.tsx) renders <html> with a static
// lang="en" because it cannot see the [locale] param, so the locale layout
// additionally injects a pre-paint script (InlineScript) for first load and
// mounts this component for soft locale switches, where inline scripts
// inserted via innerHTML never re-execute.
import {useEffect} from "react";

export function HtmlLangSync({locale}: {locale: string}) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}
