import {describe, it, expect, vi, beforeEach} from "vitest";
import type {ReactNode} from "react";
import {render, screen} from "@testing-library/react";
import {CancelAction} from "@/components/payload-admin/actions/CancelAction";

// Shared mutable mock state — vi.hoisted because vi.mock factories hoist
// above `const` declarations.
const state = vi.hoisted(() => ({
  collectionSlug: undefined as string | undefined,
  globalSlug: undefined as string | undefined,
  editDepth: 1,
}));

vi.mock("@payloadcms/ui", () => ({
  Button: (props: {to?: string; url?: string; children?: ReactNode}) => (
    <a href={props.to ?? props.url}>{props.children}</a>
  ),
  useConfig: () => ({config: {routes: {admin: "/admin"}}}),
  useDocumentInfo: () => state,
  useEditDepth: () => state.editDepth,
}));

// formatAdminURL stays real — a pure string builder from payload/shared.

describe("CancelAction", () => {
  beforeEach(() => {
    state.collectionSlug = undefined;
    state.globalSlug = undefined;
    state.editDepth = 1;
  });

  it("collection context → links to the collection list", () => {
    state.collectionSlug = "addresses";
    render(<CancelAction />);
    expect(screen.getByRole("link", {name: "Cancel"})).toHaveAttribute(
      "href",
      "/admin/collections/addresses",
    );
  });

  it("global context → links to the dashboard", () => {
    state.globalSlug = "store-settings";
    render(<CancelAction />);
    expect(screen.getByRole("link", {name: "Cancel"})).toHaveAttribute("href", "/admin");
  });

  it("renders nothing outside a document context", () => {
    const {container} = render(<CancelAction />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing inside a drawer (editDepth > 1)", () => {
    state.collectionSlug = "addresses";
    state.editDepth = 2;
    const {container} = render(<CancelAction />);
    expect(container).toBeEmptyDOMElement();
  });
});
