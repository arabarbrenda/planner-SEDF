import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createErrorEntry,
  createJurisprudenceEntry,
  createMockExam,
  updateMockExam
} from "../src/services/studyData";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  single: vi.fn()
}));

vi.mock("../src/lib/supabase", () => ({
  requireSupabase: () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from
  })
}));

describe("studyData mock exams and learning records", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-789" } }, error: null });
    mocks.from.mockReturnValue({ insert: mocks.insert, update: mocks.update });
    mocks.insert.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ single: mocks.single });
    mocks.single.mockResolvedValue({ data: { id: "record-3" }, error: null });
    mocks.update.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockResolvedValue({ error: null });
  });

  it("rejects a mock exam without a title or date before accessing Supabase", async () => {
    await expect(createMockExam({
      title: "   ", exam_date: "2026-11-23",
      total_questions: 10, correct_answers: 8
    })).rejects.toThrow("nome e a data");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("rejects mock exam scores that do not add up before accessing Supabase", async () => {
    await expect(createMockExam({
      title: "Simulado 1", exam_date: "2026-11-23",
      total_questions: 20, correct_answers: 15, incorrect_answers: 4
    })).rejects.toThrow("igual ao total");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("creates a mock exam with derived incorrect answers and authenticated ownership", async () => {
    await createMockExam({
      title: "  Simulado 1  ", exam_date: "2026-11-23",
      total_questions: 20, correct_answers: 15, blank_answers: 2
    });
    expect(mocks.from).toHaveBeenCalledWith("mock_exams");
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "user-789", title: "Simulado 1",
      total_questions: 20, correct_answers: 15,
      incorrect_answers: 3, blank_answers: 2
    }));
  });

  it("rejects invalid mock exam duration before updating", async () => {
    await expect(updateMockExam("exam-1", {
      title: "Simulado", exam_date: "2026-11-23",
      total_questions: 10, correct_answers: 8, duration_minutes: 0
    })).rejects.toThrow("duração do simulado");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("updates a mock exam without accepting a user-supplied owner id", async () => {
    await updateMockExam("exam-1", {
      title: "  Simulado revisado ", exam_date: "2026-11-23",
      total_questions: 10, correct_answers: 8, blank_answers: 1
    });
    expect(mocks.from).toHaveBeenCalledWith("mock_exams");
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      title: "Simulado revisado", total_questions: 10,
      correct_answers: 8, incorrect_answers: 1, blank_answers: 1
    }));
    expect(mocks.eq).toHaveBeenCalledWith("id", "exam-1");
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it("rejects an empty error notebook question before accessing Supabase", async () => {
    await expect(createErrorEntry({ question_text: "   " }))
      .rejects.toThrow("Descreva a questão");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("creates an error notebook entry trimmed and scoped to the signed-in user", async () => {
    await createErrorEntry({
      question_text: "  Enunciado da questão  ",
      question_reference: "  Q123  "
    });
    expect(mocks.from).toHaveBeenCalledWith("error_notebook");
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "user-789",
      question_text: "Enunciado da questão",
      question_reference: "Q123",
      status: "open"
    }));
  });

  it("rejects a non-HTTP jurisprudence source URL before accessing Supabase", async () => {
    await expect(createJurisprudenceEntry({
      title: "Tema", source_url: "javascript:alert(1)"
    })).rejects.toThrow("HTTP ou HTTPS");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("normalizes whitespace and accepts case-insensitive HTTPS URLs on update", async () => {
    await import("../src/services/studyData").then(({ updateJurisprudenceEntry }) =>
      updateJurisprudenceEntry("case-1", { source_url: "  HTTPS://example.org/case  " })
    );
    expect(mocks.from).toHaveBeenCalledWith("jurisprudence_entries");
    expect(mocks.update).toHaveBeenCalledWith({ source_url: "HTTPS://example.org/case" });
    expect(mocks.eq).toHaveBeenCalledWith("id", "case-1");
  });

  it("creates a jurisprudence entry with normalized fields and authenticated ownership", async () => {
    await createJurisprudenceEntry({
      title: "  Tema repetitivo  ", court: "  STJ  ",
      source_url: "https://example.org/julgado"
    });
    expect(mocks.from).toHaveBeenCalledWith("jurisprudence_entries");
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "user-789",
      title: "Tema repetitivo",
      court: "STJ",
      source_url: "https://example.org/julgado"
    }));
  });
});
