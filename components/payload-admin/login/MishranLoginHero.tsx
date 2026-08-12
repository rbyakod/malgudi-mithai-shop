import {CrestIcon} from "@/components/payload-admin/graphics/CrestIcon";

// Two-column hero rendered above the default Payload login form.
// Injected via admin.components.beforeLogin.
// Server component — no client interactivity needed.
export function MishranLoginHero() {
  return (
    <div
      className="mishran-login-hero"
      style={{
        display: "flex",
        gap: "1.5rem",
        padding: "1.5rem 0",
        marginBottom: "1.5rem",
        borderBottom: "1px solid var(--t-border, #e8d5b8)",
      }}
    >
      <div
        style={{
          flex: "0 0 96px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, var(--t-primary, #9b4d2a), var(--t-gold, #d79a35))",
          borderRadius: "16px",
          padding: "1rem",
        }}
      >
        <CrestIcon size={64} />
      </div>
      <div style={{flex: "1", display: "flex", flexDirection: "column", justifyContent: "center"}}>
        <h1
          style={{
            fontFamily: "var(--mishran-font-display, Outfit)",
            fontSize: "1.5rem",
            fontWeight: 600,
            color: "var(--t-text, currentColor)",
            margin: 0,
          }}
        >
          Mishran Sweets &amp; Snacks
        </h1>
        <p
          style={{
            fontSize: "0.875rem",
            color: "var(--t-text-muted, currentColor)",
            margin: "0.25rem 0 0",
          }}
        >
          Editor Console
        </p>
      </div>
    </div>
  );
}

export default MishranLoginHero;
