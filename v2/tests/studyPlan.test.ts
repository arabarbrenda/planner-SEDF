import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRevision, createStudyPlanItem } from "../src/services/studyData";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  select: vi.fn(),
  single: vi.fn()
}));

vi.mock("../src/lib/supabase", () => ({
  requireSupabase: () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from
  })
}));

describe("studyData weekly plan and revisions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-456" } }, error: null });
    mocks.from.mockReturnValue({ insert: mocks.insert });
    mocks.insert.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ single: mocks.single });
    mocks.single.mockResolvedValue({ data: { id: "record-2" }, error: null });
  });

  it("rejects a weekly block with an invalid duration", async () => {
    await expect(createStudyPlanItem({
      plan_id: "plan-1", weekday: 2, duration_minutes: 0
    })).rejects.toThrow("número positivo");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("rejects a weekly block with an invalid weekday", async () => {
    await expect(createStudyPlanItem({
      plan_id: "plan-1", weekday: 7, duration_minutes: 60
    })).rejects.toThrow("dia válido");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("creates a weekly block owned by the authenticated user", async () => {
    await createStudyPlanItem({
      plan_id: "plan-1", weekday: 3, duration_minutes: 90,
      subject_id: "subject-1", start_time: "14:00"
    });
    expect(mocks.from).toHaveBeenCalledWith("study_plan_items");
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "user-456",
      plan_id: "plan-1",
      weekday: 3,
      duration_minutes: 90,
      start_time: "14:00"
    }));
  });

  it("creates a revision linked to its topic and authenticated user", async () => {
    await createRevision({
      topic_id: "topic-1", scheduled_for: "2026-11-25", revision_type: "standard"
    });
    expect(mocks.from).toHaveBeenCalledWith("revisions");
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "user-456",
      topic_id: "topic-1",
      scheduled_for: "2026-11-25",
      revision_type: "standard"
    }));
  });
});
