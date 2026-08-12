import {describe, it, expect, vi, beforeEach} from "vitest";
import {render, screen, fireEvent} from "@testing-library/react";
import {WidgetErrorBoundary} from "@/components/payload-admin/dashboard/WidgetErrorBoundary";

const ThrowOnRender = ({shouldThrow}: {shouldThrow: boolean}) => {
  if (shouldThrow) throw new Error("boom");
  return <div data-testid="child">child content</div>;
};

describe("WidgetErrorBoundary", () => {
  beforeEach(() => {
    // Suppress React's error logging for thrown test errors
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renders children when no error", () => {
    render(
      <WidgetErrorBoundary name="Test">
        <ThrowOnRender shouldThrow={false} />
      </WidgetErrorBoundary>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("renders fallback with widget name on error", () => {
    render(
      <WidgetErrorBoundary name="My Widget">
        <ThrowOnRender shouldThrow={true} />
      </WidgetErrorBoundary>
    );
    expect(screen.getByText(/Couldn't load My Widget/i)).toBeInTheDocument();
  });

  it("retry button re-renders children", () => {
    const {rerender} = render(
      <WidgetErrorBoundary name="Test">
        <ThrowOnRender shouldThrow={true} />
      </WidgetErrorBoundary>
    );
    expect(screen.getByText(/Couldn't load Test/i)).toBeInTheDocument();

    // Click retry then rerender with non-throwing child
    fireEvent.click(screen.getByRole("button", {name: /retry/i}));
    rerender(
      <WidgetErrorBoundary name="Test">
        <ThrowOnRender shouldThrow={false} />
      </WidgetErrorBoundary>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });
});
