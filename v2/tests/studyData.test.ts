import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQuestionAttempt, createStudySession, fetchAllRows, reopenRevision } from "../src/services/studyData";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  select: vi.fn(),
  single: vi.fn(),
  rpc: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn()
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
    mocks.from.mockReturnValue({ insert: mocks.insert, update: mocks.update });
    mocks.update.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ single: mocks.single, maybeSingle: mocks.maybeSingle });
    mocks.maybeSingle.mockResolvedValue({ data: { id: "revision-1" }, error: null });
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



describe("revision mutation safeguards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReturnValue({ update: mocks.update });
    mocks.update.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ maybeSingle: mocks.maybeSingle });
  });

  it("rejects reopening a revision when RLS or a missing id affects zero rows", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(reopenRevision("revision-missing")).rejects.toThrow("Revisão não encontrada");
  });

  it("accepts reopening a revision when the database returns the affected row", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { id: "revision-1" }, error: null });
    await expect(reopenRevision("revision-1")).resolves.toBeUndefined();
    expect(mocks.from).toHaveBeenCalledWith("revisions");
    expect(mocks.eq).toHaveBeenCalledWith("id", "revision-1");
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


describe("backup export pagination", () => {
  it("fetches every page until a short page is returned", async () => {
    const fetchPage = vi.fn()
      .mockResolvedValueOnce({ data: Array.from({ length: 500 }, (_, i) => i), error: null })
      .mockResolvedValueOnce({ data: [500, 501], error: null });

    const rows = await fetchAllRows(fetchPage);

    expect(rows).toHaveLength(502);
    expect(fetchPage).toHaveBeenNthCalledWith(1, 0, 499);
    expect(fetchPage).toHaveBeenNthCalledWith(2, 500, 999);
  });

  it("returns an empty result when the first page is empty", async () => {
    const fetchPage = vi.fn().mockResolvedValue({ data: [], error: null });

    await expect(fetchAllRows(fetchPage)).resolves.toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("fails the export when any page reports a database error", async () => {
    const fetchPage = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "permission denied" }
    });

    await expect(fetchAllRows(fetchPage)).rejects.toThrow("permission denied");
  });
});


describe("atomic V1 legacy import service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends normalized data and the file fingerprint to one atomic RPC", async () => {
    const backup = {
      subjects: [{ legacy_id: "s1", name: "Direito" }],
      topics: [], sessions: [], question_attempts: [], mock_exams: [], jurisprudence: []
    };
    mocks.rpc.mockResolvedValue({ data: { success: true, rows_imported: 1 }, error: null });
    const { importLegacyV1Backup } = await import("../src/services/studyData");

    await expect(importLegacyV1Backup("a".repeat(64), "backup.json", backup)).resolves.toBe(1);
    expect(mocks.rpc).toHaveBeenCalledWith("import_legacy_v1_backup", {
      p_fingerprint: "a".repeat(64),
      p_original_file_name: "backup.json",
      p_backup: backup
    });
  });

  it("does not report success when the transaction returns a rolled-back result", async () => {
    mocks.rpc.mockResolvedValue({ data: { success: false, rows_imported: 0, error: "invalid date" }, error: null });
    const { importLegacyV1Backup } = await import("../src/services/studyData");

    await expect(importLegacyV1Backup("b".repeat(64), "backup.json", {
      subjects: [], topics: [], sessions: [], question_attempts: [], mock_exams: [], jurisprudence: []
    })).rejects.toThrow("invalid date");
  });

  it("blocks an already completed fingerprint", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate key" } });
    const { importLegacyV1Backup } = await import("../src/services/studyData");

    await expect(importLegacyV1Backup("c".repeat(64), "backup.json", {
      subjects: [], topics: [], sessions: [], question_attempts: [], mock_exams: [], jurisprudence: []
    })).rejects.toThrow("já foi importado");
  });

  it("rejects an invalid row count from the RPC", async () => {
    mocks.rpc.mockResolvedValue({ data: { success: true, rows_imported: -1 }, error: null });
    const { importLegacyV1Backup } = await import("../src/services/studyData");

    await expect(importLegacyV1Backup("d".repeat(64), "backup.json", {
      subjects: [], topics: [], sessions: [], question_attempts: [], mock_exams: [], jurisprudence: []
    })).rejects.toThrow("contagem inválida");
  });
});


describe("complete V2 backup export", () => {
  const tableNames = [
    "study_settings", "subjects", "topics", "study_sessions",
    "question_attempts", "revisions", "study_plans", "study_plan_items",
    "mock_exams", "error_notebook", "jurisprudence_entries"
  ];

  beforeEach(() => vi.clearAllMocks());

  it("exports all eleven tables with the versioned backup envelope", async () => {
    const rowsByTable = Object.fromEntries(tableNames.map((name) => [name, [{ table: name }]]));
    const range = vi.fn(async () => ({ data: [], error: null }));
    const order = vi.fn(() => ({ range }));
    const select = vi.fn(() => ({ order }));
    mocks.from.mockImplementation((table: string) => {
      const tableRange = vi.fn(async () => ({ data: rowsByTable[table], error: null }));
      const tableOrder = vi.fn(() => ({ range: tableRange }));
      const tableSelect = vi.fn(() => ({ order: tableOrder }));
      return { select: tableSelect };
    });

    const { exportPlannerBackup } = await import("../src/services/studyData");
    const backup = await exportPlannerBackup();

    expect(backup.format).toBe("planner-da-bre-v2");
    expect(backup.version).toBe(1);
    expect(Number.isNaN(Date.parse(backup.exported_at))).toBe(false);
    expect(Object.keys(backup.data)).toEqual([
      "study_settings", "subjects", "topics", "study_sessions",
      "question_attempts", "revisions", "study_plans", "study_plan_items",
      "mock_exams", "error_notebook", "jurisprudence_entries"
    ]);
    for (const table of tableNames) {
      expect(mocks.from).toHaveBeenCalledWith(table);
      expect(backup.data[table as keyof typeof backup.data]).toEqual(rowsByTable[table]);
    }
  });

  it("rejects the whole export when any table query fails", async () => {
    mocks.from.mockImplementation((table: string) => {
      const range = vi.fn(async () => table === "topics"
        ? { data: null, error: { message: "topics unavailable" } }
        : { data: [], error: null });
      const order = vi.fn(() => ({ range }));
      return { select: vi.fn(() => ({ order })) };
    });

    const { exportPlannerBackup } = await import("../src/services/studyData");
    await expect(exportPlannerBackup()).rejects.toThrow("topics unavailable");
  });
});
