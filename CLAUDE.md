@AGENTS.md

## User guide maintenance (standing rule)

`docs/user-guide.md` documents every user-facing feature across the three
surfaces — web storefront, iOS app, Android app. Whenever a feature is
added, changed, or removed on ANY platform, update the guide in the SAME
change, before commit. The guide is a deliverable, not documentation debt:
the product owner relies on it as the record of what exists and how to use
it. Keep entries customer-facing (what the user sees and does) and keep the
platform-difference notes accurate.

# Project: Malgudi Sweets – Next.js storefront

You are helping professional and polished ecommerce-style site for an Indian sweet shop (mithai).  
Stack: Next.js App Router (TypeScript) + Tailwind CSS, using `next/image` for all images.

## What this app does

- Home page marketing site with hero, best sellers, occasions, testimonials, and corporate enquiry form.
- Product catalog at `/sweets` with a grid of sweets, basic filtering, and “add to cart”.
- Product detail pages at `/sweets/[slug]` with gallery, long description, and quantity selector.
- Cart page at `/cart` with editable quantities, remove/clear, and a simple summary.
- Cart state is client-side, stored in a React context and persisted to `localStorage`.

The goal is to keep the UI visually refined and consistent (modern boutique mithai brand), while keeping the codebase understandable and easy to extend.

## Current structure (important)

- `app/layout.tsx`: wraps the app in `<CartProvider>` and sets global metadata.
- `app/page.tsx`: home page layout and marketing content.
- `app/sweets/page.tsx`: catalog listing of sweets (uses `sweets` array defined in file).
- `app/sweets/[slug]/page.tsx`: product detail page for a single sweet (currently uses a small in-file array).
- `app/cart/page.tsx`: cart view.
- `components/Header.tsx`: shared header/navigation with cart badge.
- `context/CartContext.tsx`: client-side cart context with localStorage persistence.
- `public/images/*`: static images of mithai used by `next/image`.

When you need to change behavior across pages (e.g. how cart works, adding a new field to sweets), update the data types and helpers in a central place instead of duplicating logic.

## Tech & coding preferences

- Use **Next.js App Router** conventions (no `pages/` directory).
- Use **TypeScript** with explicit types for props and data structures.
- Use **functional React components** only; no classes.
- Use **Tailwind CSS** utility classes for styling; avoid inline styles unless absolutely necessary.
- Use `next/image` for all images, with:
  - `fill` + `sizes` for responsive hero and card images.
  - `priority` / `loading="eager"` for true above-the-fold LCP images only.
- Keep components **small and focused**; prefer extracting presentational pieces into `components/` if they grow too large.

When editing existing files:
- Preserve overall layout and styling unless explicitly asked to redesign.
- Respect the existing color palette and typography choices.

## How I want you to work in this repo

1. **Always inspect files before editing.**  
   - If I ask for a change in a page or component, first open the relevant files and briefly restate how they currently work.
2. **Plan before large edits.**  
   - For non-trivial features (e.g. filters, auth, checkout), propose a short, ordered plan (2–6 steps) before touching code.
3. **Make minimal diffs.**  
   - When I say “fix this error” or “make this tweak”, show only the smallest necessary code changes, not large refactors.
4. **Keep things consistent.**  
   - Match existing naming patterns, Tailwind usage, and layout patterns in the repo.
5. **Be explicit about new entry points.**  
   - When creating a new route, clearly indicate the path (e.g. `app/account/page.tsx` → `/account`) and any new navigation links needed.

## Common tasks I’ll ask Claude to do

- Fix TypeScript errors and Next.js build/runtime warnings.
- Adjust layout and spacing in React components using Tailwind.
- Add or modify sections on the homepage and catalog (e.g. new occasion, new testimonial, new sweet).
- Extend the cart (e.g. computed totals, discount codes, persistent notes).
- Factor shared data (e.g. sweets list) into a shared module instead of being duplicated across pages.
- Prepare the project for deployment to Vercel (env vars, build settings, etc.).

When doing any of these:

- Prefer small, incremental changes and explain what you changed and why.
- If something is ambiguous, ask one concrete clarifying question before making big structural changes.

## Architectural preferences

- **Data model**: For now, hardcoded arrays (like `sweets[]`) in a shared file/module are fine. If I ask for it, propose a simple data layer (e.g. JSON, small DB, or headless CMS) and show how you would adapt the pages.
- **Cart**:
  - Cart lives entirely on the client via context; do not introduce server actions or DB writes unless requested.
  - Cart items use `{ id, name, priceLabel, quantity, image }`.
  - Keep the cart code readable and easy to extend (e.g. later we might add per-item notes or variants).
- **Accessibility**:
  - Use semantic HTML (headings, landmarks, `aria-label` where appropriate).
  - Maintain good color contrast and focus styles.

## When something breaks

If a change you propose might break types, runtime, or styles:

- Call out potential side effects explicitly.
- Suggest any follow-up steps (e.g. update `sweets` data, add images, run `npm run lint`).
- If you’re not sure how a library behaves, check docs first and then propose a safe change.

## Commands

Assume the standard Next.js scripts unless I say otherwise:

- `npm run dev` – run locally at `http://localhost:3000`.
- `npm run lint` – TypeScript/ESLint checks.
- `npm run build` – production build.

If you add new scripts or tooling, document them inline and mention them in your response.

## Upcoming features to implement

I now want to add four major capabilities:

1. Search + filter on the sweets catalog
2. Razorpay payment integration
3. Theme switching (global color theme dropdown)
4. Multi-language support (Spanish, French, and 6–8 major Indian languages)

Please treat these as separate, incremental features and avoid mixing large refactors together.

### 1. Search + filter (catalog)

Goals:

- Add a search bar at the top of `/sweets` to filter the sweets list by:
  - Name (e.g. “kaju”, “gulab”)
  - Category (classic, dryfruit, bengali, sugarfree, seasonal)
  - Optional tags (e.g. “gift box”, “festive”)
- Search should:
  - Be implemented in a **client component** in `app/sweets/page.tsx` for now.
  - Preferably sync with URL query params using `useSearchParams` / `useRouter` (`next/navigation`) so search state is shareable and bookmarkable.
- Keep the visual style consistent with the rest of the site (Tailwind, rounded inputs, subtle borders).

When implementing:
- Start by extracting the `sweets` array into a separate `data/sweets.ts` module so it can be reused (catalog + detail + future features).
- Implement a client-side search/filter function that filters the in-memory list.
- In a later iteration, we may change this to server-side filtering, but not now.

### 2. Razorpay integration

Goals:

- Add a simple Razorpay checkout button on the `/cart` page that:
  - Calculates a basic total (for now, we can parse price numbers from `priceLabel` or introduce a numeric `priceInPaise` field on the data model).
  - Calls a small `/api/razorpay` or `/api/create-order` route to create an order using Razorpay’s API.
  - Opens Razorpay’s checkout widget on the client with order details.
- Use the recommended Next.js + Razorpay flow with:
  - A server route that uses Razorpay secret key (from env vars) to create orders.
  - A client component in `app/cart/page.tsx` that loads the Razorpay script and triggers the payment popup.
- For now, verifying payment and marking orders as paid can be stubbed or logged; later we can introduce proper verification.

Constraints:

- Keep all Razorpay keys in environment variables:
  - `NEXT_PUBLIC_RAZORPAY_KEY_ID` for client
  - `RAZORPAY_KEY_SECRET` for server
- Follow current Next.js App Router conventions for API routes.

### 3. Theme switching (dropdown to change global color theme)

Goals:

- Add a theme dropdown (e.g. in the header) that allows switching between:
  - At least 2–3 themes (e.g. “Festive saffron/red”, “Evening navy/gold”, “Minimal cream/green”).
- Implement theming using:
  - CSS variables and Tailwind configuration (preferred),
  - Or a small library like `next-themes` if needed.
- Theme choice should:
  - Affect global colors (backgrounds, text, primary buttons) across the site.
  - Persist in localStorage so the selected theme survives reloads.

Constraints:

- Do not rewrite all Tailwind classes. Instead, refactor the palette so key colors reference CSS variables, and have theme-specific variable sets.
- Implement the theme selector as a **client component**, ideally in `Header.tsx`, that toggles a `data-theme` attribute on `<html>` or `<body>`.

### 4. Multilingual support (Spanish, French, Indian languages)

Goals:

- Introduce i18n support using a library compatible with Next.js App Router such as `next-intl` or similar.
- Start with:
  - English (current)
  - Spanish
  - French
  - 6–8 major Indian languages (e.g. Hindi, Kannada, Tamil, Telugu, Bengali, Marathi, Gujarati, Punjabi — I can adjust the final list).
- At first, we only need a few key pages translated (home, catalog, header/footer text).

Constraints:

- Use a clean i18n setup:
  - Locale-based routing (`/en`, `/es`, `/fr`, `/hi`, etc.) if reasonable.
  - Organized translation files, e.g. `locales/en/common.json`, `locales/hi/common.json`.
- Keep initial translations minimal; I can refine copy later.

When implementing:

- Start by wiring the i18n library and locale switcher (e.g. dropdown in the header).
- Then migrate the main textual content on the homepage and header/footer to use translation keys.
- For any non-trivial or culturally specific copy, leave placeholders or English versions with a TODO comment.

### General guidance for these features

- Implement each feature in separate, well-scoped changes:
  - First: refactor sweets data into a shared module, then add client-side search/filter.
  - Next: add Razorpay integration (API route + cart button).
  - Then: add theme switching and refactor colors to variables.
  - Finally: set up i18n and wire basic translations.
- Before changing many files, show a short plan (2–6 steps) and get my confirmation.
- After each feature, explain briefly how to use it (e.g. which URLs, which environment vars).