import { describe, expect, it } from "vitest";
import { buildWeeklyCalendar } from "./weeklyCalendar";
import type { StudyPlanItem } from "../types/database";

function item(overrides: Partial<StudyPlanItem> = {}): StudyPlanItem {
  return {
    id: "block-1", user_id: "user-1", plan_id: "plan-1", subject_id: "subject-1",
    topic_id: "topic-1", weekday: 1, start_time: "14:30:00", duration_minutes: 90,
    sort_order: 0, notes: "Teoria, questões; revisão",
    subjects: { name: "Direito Administrativo" }, topics: { name: "Atos administrativos" },
    ...overrides
  };
}

describe("buildWeeklyCalendar", () => {
  it("exports recurring events on the next matching weekday in São Paulo local time", () => {
    const result = buildWeeklyCalendar([item()], "2026-11-23"); // Monday
    expect(result.exported).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.calendar).toContain("DTSTART;TZID=America/Sao_Paulo:20261123T143000");
    expect(result.calendar).toContain("DTEND;TZID=America/Sao_Paulo:20261123T160000");
    expect(result.calendar).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO");
  });

  it("moves a past weekday to the next week and escapes event text", () => {
    const result = buildWeeklyCalendar([item({ weekday: 1, notes: "A, B; C\\nD" })], "2026-11-24");
    expect(result.calendar).toContain("DTSTART;TZID=America/Sao_Paulo:20261130T143000");
    expect(result.calendar).toContain("SUMMARY:Direito Administrativo \\— Atos administrativos");
    expect(result.calendar).toContain("DESCRIPTION:A\\, B\\; C\\nD");
  });

  it("skips blocks without a valid weekday or start time", () => {
    const result = buildWeeklyCalendar([
      item({ start_time: null }),
      item({ weekday: null }),
      item()
    ], "2026-11-23");
    expect(result.exported).toBe(1);
    expect(result.skipped).toBe(2);
  });
});
