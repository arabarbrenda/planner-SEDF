import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQuestionAttempt, createStudySession } from "../src/services/studyData";

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

describe("studyData session and question records", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-123" } }, error: null });
    mocks.from.mockReturnValue({ insert: mocks.insert });
    mocks.insert.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ single: mocks.single });
    mocks.single.mockResolvedValue({ data: { id: "record-1" }, error: null });
  });

  it("rejects invalid study session durations before accessing Supabase", async () => {
    await expect(createStudySession({ duration_minutes: 0 })).rejects.toThrow("número positivo");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("creates a session scoped to the authenticated user", async () => {
    await createStudySession({ duration_minutes: 45, notes: "Leitura" });
    expect(mocks.from).toHaveBeenCalledWith("study_sessions");
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "user-123",
      duration_minutes: 45,
      notes: "Leitura",
      subject_id: null,
      topic_id: null
    }));
  });

  it("rejects question totals that exceed the attempt total", async () => {
    await expect(createQuestionAttempt({ total_questions: 10, correct_answers: 8, incorrect_answers: 3 }))
      .rejects.toThrow("não podem superar o total");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("derives incorrect answers and scopes the attempt to the authenticated user", async () => {
    await createQuestionAttempt({ total_questions: 12, correct_answers: 9 });
    expect(mocks.from).toHaveBeenCalledWith("question_attempts");
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "user-123",
      total_questions: 12,
      correct_answers: 9,
      incorrect_answers: 3,
      blank_answers: 0,
      source: "manual"
    }));
  });
});
