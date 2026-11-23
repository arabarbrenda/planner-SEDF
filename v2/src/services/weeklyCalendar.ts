import type { StudyPlanItem } from "../types/database";

const weekdays = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function escapeIcsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatLocalDateTime(date: Date): string {
  return date.getUTCFullYear() + pad(date.getUTCMonth() + 1) + pad(date.getUTCDate()) +
    "T" + pad(date.getUTCHours()) + pad(date.getUTCMinutes()) + "00";
}

function nextWeekday(referenceDate: string, weekday: number): Date {
  const [year, month, day] = referenceDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const daysAhead = (weekday - date.getUTCDay() + 7) % 7;
  date.setUTCDate(date.getUTCDate() + daysAhead);
  return date;
}

export type CalendarExportResult = { calendar: string; exported: number; skipped: number };

export function buildWeeklyCalendar(
  items: StudyPlanItem[],
  referenceDate: string
): CalendarExportResult {
  const valid = items.filter(item =>
    item.weekday !== null && Number.isInteger(item.weekday) && item.weekday >= 0 && item.weekday <= 6 &&
    typeof item.start_time === "string" && /^([01]\\d|2[0-3]):[0-5]\\d/.test(item.start_time) &&
    Number.isInteger(item.duration_minutes) && item.duration_minutes > 0
  );

  const events = valid.map(item => {
    const start = nextWeekday(referenceDate, item.weekday!);
    const [hour, minute] = item.start_time!.slice(0, 5).split(":").map(Number);
    start.setUTCHours(hour, minute, 0, 0);
    const end = new Date(start.getTime() + item.duration_minutes * 60_000);
    const title = [item.subjects?.name, item.topics?.name].filter(Boolean).join(" — ") || "Bloco de estudo";
    const description = [item.notes, `Duração: ${item.duration_minutes} minutos`].filter(Boolean).join("\\n");
    return [
      "BEGIN:VEVENT",
      `UID:${escapeIcsText(item.id)}@planner-da-bre`,
      `DTSTAMP:${formatLocalDateTime(new Date())}Z`,
      `DTSTART;TZID=America/Sao_Paulo:${formatLocalDateTime(start)}`,
      `DTEND;TZID=America/Sao_Paulo:${formatLocalDateTime(end)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${weekdays[item.weekday!]}`,
      `SUMMARY:${escapeIcsText(title)}`,
      `DESCRIPTION:${escapeIcsText(description)}`,
      "END:VEVENT"
    ].join("\r\n");
  });

  const calendar = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Planner da Bre//Weekly Study Plan//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events,
    "END:VCALENDAR"
  ].join("\r\n") + "\r\n";

  return { calendar, exported: valid.length, skipped: items.length - valid.length };
}
