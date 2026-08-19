import {CrestIcon} from "@/components/payload-admin/graphics/CrestIcon";

// Boutique hero rendered above the default Payload login form.
// Injected via admin.components.beforeLogin. Audit §08: the login screen is
// the front door for staff — it should feel like the brand, not the
// framework. Server component — no client interactivity needed.
export function MishranLoginHero() {
  return (
    <div
      className="mishran-login-hero"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "1.25rem",
        padding: "1.75rem 1.5rem",
        marginBottom: "1.75rem",
        borderRadius: "1rem",
        // Cream card with a hairline gold border — mirrors the storefront's
        // boutique cards rather than the framework's flat panel.
        background: "var(--t-bg-card, #fdf8ed)",
        border: "1px solid var(--t-gold, #d79a35)",
      }}
    >
      <div
        style={{
          flex: "0 0 72px",
          height: "72px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, var(--t-primary, #9b4d2a), var(--t-gold, #d79a35))",
          borderRadius: "14px",
          boxShadow: "0 6px 18px rgba(107, 30, 30, 0.25)",
        }}
        aria-hidden="true"
      >
        <CrestIcon size={44} />
      </div>
      <div style={{flex: "1", minWidth: 0}}>
        <p
          style={{
            fontSize: "0.625rem",
            fontWeight: 600,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--t-gold, #d79a35)",
            margin: "0 0 0.35rem",
          }}
        >
          Mishran Sweets &amp; Snacks
        </p>
        <h1
          style={{
            fontFamily: "var(--mishran-font-display, Outfit)",
            fontSize: "1.5rem",
            fontWeight: 600,
            color: "var(--t-text, currentColor)",
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          Welcome back
        </h1>
        <p
          style={{
            fontSize: "0.8125rem",
            color: "var(--t-text-muted, currentColor)",
            margin: "0.35rem 0 0",
            lineHeight: 1.5,
          }}
        >
          Sign in to tend the shop — catalog, orders, stories and everything
          in between.
        </p>
      </div>
    </div>
  );
}

export default MishranLoginHero;
