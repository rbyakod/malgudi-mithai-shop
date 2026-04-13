import {Link} from "@/i18n/navigation";

export default function NotFound() {
  return (
    <div className="relative z-10 flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-xs font-medium tracking-wide text-primary">404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-text-primary">
        Page not found
      </h1>
      <p className="mt-3 max-w-md text-sm text-text-muted">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
        Head back to our homepage or browse the sweets catalog.
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/"
          className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-text-light shadow-sm transition hover:bg-primary-hover"
        >
          Go home
        </Link>
        <Link
          href="/sweets"
          className="rounded-full border border-border-input bg-bg-card px-6 py-2.5 text-sm font-semibold text-text-secondary transition hover:bg-bg-accent/60"
        >
          Browse sweets
        </Link>
      </div>
    </div>
  );
}
