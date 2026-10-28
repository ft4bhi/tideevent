import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PosterImage } from "@/components/events/poster-image";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  cleanup();
});

describe("PosterImage", () => {
  it("renders the image when a valid poster URL is provided", () => {
    render(<PosterImage src="https://images.pexels.com/photo.jpg" alt="Event poster" />);
    const img = screen.getByAltText("Event poster");
    expect(img).toHaveAttribute("src", "https://images.pexels.com/photo.jpg");
  });

  it("renders the placeholder when no src is provided", () => {
    render(<PosterImage alt="Event poster" />);
    expect(screen.getByRole("img", { name: "Event poster" })).toBeInTheDocument();
    expect(screen.queryByAltText("Event poster")).not.toBeInTheDocument();
  });

  it("renders the placeholder when src is an empty string", () => {
    render(<PosterImage src="" alt="Event poster" />);
    expect(screen.getByRole("img", { name: "Event poster" })).toBeInTheDocument();
    expect(screen.queryByAltText("Event poster")).not.toBeInTheDocument();
  });

  it("falls back to placeholder when the image fails to load", () => {
    render(<PosterImage src="https://images.pexels.com/photo.jpg" alt="Event poster" />);
    const img = screen.getByAltText("Event poster");
    expect(img).toHaveAttribute("src", "https://images.pexels.com/photo.jpg");
    img.dispatchEvent(new ErrorEvent("error"));
    expect(screen.queryByAltText("Event poster")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Event poster" })).toBeInTheDocument();
  });
});
