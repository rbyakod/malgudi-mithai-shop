// Inline script injected before hydration to read the theme cookie and set
// body[data-admin-theme] — prevents theme flash on cold load.
// Rendered as a Next.js Script with strategy="beforeInteractive".
import Script from "next/script";
import {ADMIN_THEME_COOKIE, DEFAULT_ADMIN_THEME, ADMIN_THEMES} from "./admin-theme";

const scriptContent = `
(function() {
  try {
    var match = document.cookie.match(/(?:^|;\\s)${ADMIN_THEME_COOKIE}=([^;]+)/);
    var value = match ? decodeURIComponent(match[1]) : "${DEFAULT_ADMIN_THEME}";
    var known = ${JSON.stringify(ADMIN_THEMES)};
    if (known.indexOf(value) === -1) value = "${DEFAULT_ADMIN_THEME}";
    document.body.setAttribute("data-admin-theme", value);
  } catch (e) {
    document.body.setAttribute("data-admin-theme", "${DEFAULT_ADMIN_THEME}");
  }
})();
`;

export function AdminThemeBootScript() {
  return <Script id="mishran-admin-theme-boot" strategy="beforeInteractive" dangerouslySetInnerHTML={{__html: scriptContent}} />;
}

export default AdminThemeBootScript;
