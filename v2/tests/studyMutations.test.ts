import { beforeEach, describe, expect, it, vi } from "vitest";
import { completeRevision, deleteStudyPlanItem, updateErrorEntry, updateJurisprudenceEntry, updateTopicStatus } from "../src/services/studyData";

const mocks = vi.hoisted(() => ({
  from: vi.fn(), update: vi.fn(), delete: vi.fn(), eq: vi.fn(), is: vi.fn(),
  select: vi.fn(), maybeSingle: vi.fn(),
  deleteResult: { data: [{ id: "row-1" }], error: null }
}));

vi.mock("../src/lib/supabase", () => ({ requireSupabase: () => ({ from: mocks.from }) }));

describe("study data mutation safeguards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deleteResult = { data: [{ id: "row-1" }], error: null };
    mocks.from.mockReturnValue({ update: mocks.update, delete: mocks.delete });
    mocks.update.mockReturnValue({ eq: mocks.eq });
    mocks.delete.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockReturnValue({ is: mocks.is, select: mocks.select });
    mocks.is.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({
      maybeSingle: mocks.maybeSingle,
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(mocks.deleteResult).then(resolve)
    });
    mocks.maybeSingle.mockResolvedValue({ data: { id: "row-1" }, error: null });
  });

  it("updates topic status and reports a missing topic", async () => {
    await expect(updateTopicStatus("topic-1", "in_progress")).resolves.toBeUndefined();
    expect(mocks.from).toHaveBeenCalledWith("topics");
    expect(mocks.update).toHaveBeenCalledWith({ status: "in_progress" });
    expect(mocks.eq).toHaveBeenCalledWith("id", "topic-1");
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(updateTopicStatus("missing", "completed")).rejects.toThrow("Tópico não encontrado ou sem permissão");
  });

  it("completes only a pending revision and reports zero affected rows", async () => {
    await expect(completeRevision("revision-1", "easy", "Revisão concluída")).resolves.toBeUndefined();
    expect(mocks.from).toHaveBeenCalledWith("revisions");
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ result: "easy", notes: "Revisão concluída" }));
    expect(mocks.eq).toHaveBeenCalledWith("id", "revision-1");
    expect(mocks.is).toHaveBeenCalledWith("completed_at", null);
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(completeRevision("revision-1", "easy")).rejects.toThrow("Revisão não encontrada, já concluída ou sem permissão");
  });

  it("deletes weekly plan blocks only when a row was removed", async () => {
    await expect(deleteStudyPlanItem("block-1")).resolves.toBeUndefined();
    expect(mocks.from).toHaveBeenCalledWith("study_plan_items");
    expect(mocks.delete).toHaveBeenCalled();
    expect(mocks.eq).toHaveBeenCalledWith("id", "block-1");
    mocks.deleteResult = { data: [], error: null };
    await expect(deleteStudyPlanItem("missing-block")).rejects.toThrow("Bloco não encontrado ou sem permissão");
  });

  it("updates error content, trims fields and rejects empty questions", async () => {
    await updateErrorEntry("error-1", { question_text: "  Enunciado revisado  ", question_reference: "  Q-10  ", tags: ["constitucional"] });
    expect(mocks.from).toHaveBeenCalledWith("error_notebook");
    expect(mocks.update).toHaveBeenCalledWith({ question_reference: "Q-10", question_text: "Enunciado revisado", tags: ["constitucional"] });
    await expect(updateErrorEntry("error-1", { question_text: "  " })).rejects.toThrow("Descreva a questão");
  });

  it("reports when an error notebook update affects no row", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(updateErrorEntry("missing", { explanation: "Revisar" })).rejects.toThrow("Registro de erro não encontrado ou sem permissão");
  });

  it("updates jurisprudence fields and normalizes source URLs", async () => {
    await updateJurisprudenceEntry("case-1", { title: "  Tema revisado  ", source_url: "  HTTPS://example.org/tema  " });
    expect(mocks.from).toHaveBeenCalledWith("jurisprudence_entries");
    expect(mocks.update).toHaveBeenCalledWith({ title: "Tema revisado", source_url: "HTTPS://example.org/tema" });
    await expect(updateJurisprudenceEntry("case-1", { source_url: "javascript:alert(1)" })).rejects.toThrow("HTTP ou HTTPS");
    await expect(updateJurisprudenceEntry("case-1", { title: " " })).rejects.toThrow("Informe o título");
  });

  it("reports when a jurisprudence update affects no row", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(updateJurisprudenceEntry("missing", { summary: "Resumo" })).rejects.toThrow("Jurisprudência não encontrada ou sem permissão");
  });
});
