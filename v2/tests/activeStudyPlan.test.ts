import { beforeEach, describe, expect, it, vi } from "vitest";
import { getActiveStudyPlan } from "../src/services/studyData";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
  insert: vi.fn(),
  single: vi.fn()
}));

vi.mock("../src/lib/supabase", () => ({
  requireSupabase: () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from
  })
}));

describe("active weekly study plan initialization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReturnValue({
      select: mocks.select,
      insert: mocks.insert
    });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
    mocks.insert.mockReturnValue({ select: mocks.select });
    mocks.select.mockImplementation(() => ({
      eq: mocks.eq,
      single: mocks.single
    }));
    mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
    mocks.single.mockResolvedValue({ data: { id: "plan-new" }, error: null });
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  });

  it("returns the existing active plan without creating another one", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { id: "plan-existing", is_active: true }, error: null });

    await expect(getActiveStudyPlan()).resolves.toMatchObject({ id: "plan-existing" });
    expect(mocks.from).toHaveBeenCalledWith("study_plans");
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it("creates an active plan for the authenticated user when none exists", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(getActiveStudyPlan()).resolves.toMatchObject({ id: "plan-new" });
    expect(mocks.getUser).toHaveBeenCalled();
    expect(mocks.insert).toHaveBeenCalledWith({
      user_id: "user-1",
      name: "Meu planejamento semanal",
      is_active: true
    });
  });

  it("recovers from a concurrent active-plan creation", async () => {
    mocks.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { id: "plan-created-in-another-tab", is_active: true }, error: null });
    mocks.single.mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate active plan" } });

    await expect(getActiveStudyPlan()).resolves.toMatchObject({ id: "plan-created-in-another-tab" });
    expect(mocks.maybeSingle).toHaveBeenCalledTimes(2);
  });

  it("propagates a failure to read the active plan", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: { message: "read failed" } });

    await expect(getActiveStudyPlan()).rejects.toMatchObject({ message: "read failed" });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("propagates a non-duplicate failure to create the active plan", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    mocks.single.mockResolvedValue({ data: null, error: { code: "42501", message: "insert denied" } });

    await expect(getActiveStudyPlan()).rejects.toMatchObject({ message: "insert denied" });
  });
});
