import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PATCH } from "./route";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

const mockWhere = vi.hoisted(() => vi.fn());
const mockOnConflictDoUpdate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: mockWhere,
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: mockOnConflictDoUpdate,
      }),
    }),
  },
}));

const { auth } = await import("@/lib/auth");

describe("GET /api/notifications/preferences", () => {
  beforeEach(() => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", email: "u@example.com" },
      expires: "",
    });
    mockWhere.mockResolvedValue([
      {
        emailDigestEnabled: "true",
        confirmationEmailEnabled: "true",
        meetingReminderEnabled: "true",
        meetingReminderMinutesBefore: 60,
      },
    ]);
    mockOnConflictDoUpdate.mockResolvedValue(undefined);
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns preferences when authenticated", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.emailDigestEnabled).toBe("true");
    expect(json.confirmationEmailEnabled).toBe("true");
    expect(json.meetingReminderEnabled).toBe("true");
    expect(json.meetingReminderMinutesBefore).toBe(60);
  });

  it("returns defaults when no row exists", async () => {
    mockWhere.mockResolvedValue([]);
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.emailDigestEnabled).toBe("true");
    expect(json.meetingReminderMinutesBefore).toBe(60);
  });
});

describe("PATCH /api/notifications/preferences", () => {
  beforeEach(() => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", email: "u@example.com" },
      expires: "",
    });
    mockOnConflictDoUpdate.mockResolvedValue(undefined as never);
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const req = new Request("http://localhost/api/notifications/preferences", {
      method: "PATCH",
      body: JSON.stringify({ emailDigestEnabled: "false" }),
    });
    const res = await PATCH(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(401);
  });

  it("updates and returns ok", async () => {
    const req = new Request("http://localhost/api/notifications/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        emailDigestEnabled: "false",
        meetingReminderMinutesBefore: 30,
      }),
    });
    const res = await PATCH(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });
});
