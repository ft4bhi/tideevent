import { afterEach, beforeEach, cleanup, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QRCodeBadge } from "@/components/bookings/qr-code";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  cleanup();
});

describe("QRCodeBadge", () => {
  it("renders QR code SVG with the ticket token", () => {
    render(<QRCodeBadge value="ticket-token-abc123" size={120} />);
    const svg = screen.getByTagName("svg");
    expect(svg).toBeInTheDocument();
  });

  it("uses default size when not specified", () => {
    render(<QRCodeBadge value="ticket-token-abc123" />);
    const svg = screen.getByTagName("svg");
    expect(svg).toBeInTheDocument();
  });
});
