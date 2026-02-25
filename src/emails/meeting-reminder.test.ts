import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendMeetingReminderEmail } from "./meeting-reminder";

const mockSend = vi.fn().mockResolvedValue({ data: { id: "test-id" }, error: null });

vi.mock("resend", () => ({
  Resend: class MockResend {
    emails = { send: mockSend };
  },
}));

describe("sendMeetingReminderEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = "test-key";
  });

  it("sends one email with meeting name, date, and links", async () => {
    const result = await sendMeetingReminderEmail({
      to: "user@example.com",
      eventName: "Regular Governing Body Meeting",
      startDateTime: "2026-02-26T17:00:00.000Z",
      eventId: 42,
      appUrl: "https://app.example.com",
    });

    expect(result.error).toBeNull();
    expect(mockSend).toHaveBeenCalledTimes(1);
    const call = mockSend.mock.calls[0][0];
    expect(call.to).toBe("user@example.com");
    expect(call.subject).toContain("Reminder");
    expect(call.subject).toContain("Regular Governing Body Meeting");
    expect(call.html).toContain("Meeting reminder");
    expect(call.html).toContain("Regular Governing Body Meeting");
    expect(call.html).toContain("https://app.example.com/meeting/42");
    expect(call.html).toContain("https://app.example.com/my-follows");
    expect(call.html).toContain("Manage your alerts");
    expect(call.text).toContain("https://app.example.com/meeting/42");
    expect(call.text).toContain("https://app.example.com/profile");
  });
});
