import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQuestionAttempt, createStudySession } from "../src/services/studyData";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  select: vi.fn(),
  single: vi.fn(),
  rpc: vi.fn()
}));

vi.mock("../src/lib/supabase", () => ({
  requireSupabase: () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
    rpc: mocks.rpc
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


describe("V2 backup restoration service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends the backup unchanged to the transactional restore RPC", async () => {
    const backup = { format: "planner-da-bre-v2", version: 1, data: {} };
    mocks.rpc.mockResolvedValue({ data: [{ inserted_rows: 7 }], error: null });

    await expect((await import("../src/services/studyData")).restorePlannerBackup(backup)).resolves.toBe(7);
    expect(mocks.rpc).toHaveBeenCalledWith("restore_planner_backup", { p_backup: backup });
  });

  it("accepts a numeric string returned by PostgreSQL", async () => {
    mocks.rpc.mockResolvedValue({ data: { inserted_rows: "12" }, error: null });
    const { restorePlannerBackup } = await import("../src/services/studyData");

    await expect(restorePlannerBackup({})).resolves.toBe(12);
  });

  it("rejects an invalid inserted-row count", async () => {
    mocks.rpc.mockResolvedValue({ data: { inserted_rows: "not-a-number" }, error: null });
    const { restorePlannerBackup } = await import("../src/services/studyData");

    await expect(restorePlannerBackup({})).rejects.toThrow("resultado inválido");
  });

  it("propagates database errors without reporting a successful restore", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("restore failed") });
    const { restorePlannerBackup } = await import("../src/services/studyData");

    await expect(restorePlannerBackup({})).rejects.toThrow("restore failed");
  });
});
