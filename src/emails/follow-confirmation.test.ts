import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendFollowConfirmationEmail } from "./follow-confirmation";

const mockSend = vi.fn().mockResolvedValue({ data: { id: "test-id" }, error: null });

vi.mock("resend", () => ({
  Resend: class MockResend {
    emails = { send: mockSend };
  },
}));

describe("sendFollowConfirmationEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = "test-key";
  });

  it("sends one email with correct to, subject, and body for category", async () => {
    const result = await sendFollowConfirmationEmail({
      to: "user@example.com",
      type: "category",
      name: "Governing Body",
      appUrl: "https://app.example.com",
    });

    expect(result.error).toBeNull();
    expect(mockSend).toHaveBeenCalledTimes(1);
    const call = mockSend.mock.calls[0][0];
    expect(call.to).toBe("user@example.com");
    expect(call.subject).toContain("Governing Body");
    expect(call.subject).toMatch(/following/);
    expect(call.html).toContain("You're now following Governing Body");
    expect(call.html).toContain("daily digest");
    expect(call.html).toContain("https://app.example.com/my-follows");
    expect(call.text).toContain("Governing Body");
    expect(call.text).toContain("https://app.example.com/my-follows");
  });

  it("sends one email with correct content for meeting", async () => {
    const result = await sendFollowConfirmationEmail({
      to: "user@example.com",
      type: "meeting",
      name: "Regular Governing Body Meeting",
      appUrl: "https://app.example.com",
    });

    expect(result.error).toBeNull();
    expect(mockSend).toHaveBeenCalledTimes(1);
    const call = mockSend.mock.calls[0][0];
    expect(call.to).toBe("user@example.com");
    expect(call.subject).toContain("Regular Governing Body Meeting");
    expect(call.html).toContain("You're now following Regular Governing Body Meeting");
    expect(call.html).toContain("reminder 1 hour before");
    expect(call.html).toContain("https://app.example.com/my-follows");
  });
});
