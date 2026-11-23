import { requireSupabase } from "../lib/supabase";
import type { QuestionAttempt, QuestionAttemptInsert, StudySession, StudySessionInsert, Subject, SubjectInsert, Topic, TopicInsert, TopicStatus, Revision, RevisionInsert, RevisionResult, StudyPlan, StudyPlanItem, StudyPlanItemInsert, MockExam, MockExamInsert, ErrorNotebookEntry, ErrorNotebookInsert, ErrorStatus, JurisprudenceEntry, JurisprudenceInsert } from "../types/database";

function currentUserId() {
  return requireSupabase().auth.getUser().then(({ data, error }) => {
    if (error) throw error;
    if (!data.user) throw new Error("Você precisa entrar para acessar seus dados.");
    return data.user.id;
  });
}

export async function listSubjects(): Promise<Subject[]> {
  const client = requireSupabase();
  const { data, error } = await client.from("subjects").select("*").order("sort_order").order("name");
  if (error) throw error;
  return (data ?? []) as Subject[];
}

export async function createSubject(input: SubjectInsert): Promise<Subject> {
  const client = requireSupabase();
  const userId = await currentUserId();
  const { data, error } = await client.from("subjects").insert({
    user_id: userId,
    name: input.name.trim(),
    icon: input.icon ?? null,
    priority: input.priority ?? "medium",
    sort_order: input.sort_order ?? 0
  }).select("*").single();
  if (error) throw error;
  return data as Subject;
}

export async function listTopics(subjectId?: string): Promise<Topic[]> {
  let query = requireSupabase().from("topics").select("*").order("sort_order").order("name");
  if (subjectId) query = query.eq("subject_id", subjectId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Topic[];
}

export async function createTopic(input: TopicInsert): Promise<Topic> {
  const client = requireSupabase();
  const userId = await currentUserId();
  const { data, error } = await client.from("topics").insert({
    user_id: userId,
    subject_id: input.subject_id,
    name: input.name.trim(),
    parent_topic_id: input.parent_topic_id ?? null,
    status: input.status ?? "not_started",
    priority: input.priority ?? null,
    annotations: input.annotations ?? "",
    checklist: input.checklist ?? { theory: false, law: false, questions: false, errors: false, revision: false },
    sort_order: input.sort_order ?? 0
  }).select("*").single();
  if (error) throw error;
  return data as Topic;
}

export async function updateTopicStatus(topicId: string, status: TopicStatus): Promise<void> {
  const { error } = await requireSupabase().from("topics").update({ status }).eq("id", topicId);
  if (error) throw error;
}

export async function createStudySession(input: StudySessionInsert): Promise<StudySession> {
  const client = requireSupabase();
  const userId = await currentUserId();
  const { data, error } = await client.from("study_sessions").insert({
    user_id: userId,
    subject_id: input.subject_id ?? null,
    topic_id: input.topic_id ?? null,
    studied_on: input.studied_on ?? new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
    duration_minutes: input.duration_minutes,
    platform: input.platform ?? null,
    notes: input.notes ?? ""
  }).select("*").single();
  if (error) throw error;
  return data as StudySession;
}

export async function createQuestionAttempt(input: QuestionAttemptInsert): Promise<QuestionAttempt> {
  if (input.total_questions < 0 || input.correct_answers < 0 || input.correct_answers > input.total_questions) {
    throw new Error("Confira a quantidade de questões e acertos.");
  }
  const incorrect = input.incorrect_answers ?? Math.max(0, input.total_questions - input.correct_answers - (input.blank_answers ?? 0));
  const blank = input.blank_answers ?? 0;
  if (input.correct_answers + incorrect + blank > input.total_questions) {
    throw new Error("Acertos, erros e questões em branco não podem superar o total.");
  }
  const client = requireSupabase();
  const userId = await currentUserId();
  const { data, error } = await client.from("question_attempts").insert({
    user_id: userId,
    subject_id: input.subject_id ?? null,
    topic_id: input.topic_id ?? null,
    attempted_on: input.attempted_on ?? new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
    platform: input.platform ?? null,
    source: input.source ?? "manual",
    total_questions: input.total_questions,
    correct_answers: input.correct_answers,
    incorrect_answers: incorrect,
    blank_answers: blank,
    notes: input.notes ?? "",
    external_reference: input.external_reference ?? null
  }).select("*").single();
  if (error) throw error;
  return data as QuestionAttempt;
}

export async function getStudySummary() {
  const client = requireSupabase();
  const [subjects, sessions, attempts] = await Promise.all([
    client.from("subjects").select("id", { count: "exact", head: true }),
    client.from("study_sessions").select("duration_minutes"),
    client.from("question_attempts").select("total_questions,correct_answers")
  ]);
  if (subjects.error) throw subjects.error;
  if (sessions.error) throw sessions.error;
  if (attempts.error) throw attempts.error;
  const minutes = (sessions.data ?? []).reduce((sum, row) => sum + row.duration_minutes, 0);
  const totalQuestions = (attempts.data ?? []).reduce((sum, row) => sum + row.total_questions, 0);
  const correctAnswers = (attempts.data ?? []).reduce((sum, row) => sum + row.correct_answers, 0);
  return {
    subjectCount: subjects.count ?? 0,
    studyMinutes: minutes,
    totalQuestions,
    correctAnswers,
    accuracy: totalQuestions > 0 ? Math.round(correctAnswers / totalQuestions * 100) : null
  };
}

export async function listRevisions(): Promise<Revision[]> {
  const { data, error } = await requireSupabase()
    .from("revisions")
    .select("*, topics(name)")
    .order("scheduled_for", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Revision[];
}

export async function createRevision(input: RevisionInsert): Promise<Revision> {
  const userId = await currentUserId();
  const { data, error } = await requireSupabase().from("revisions").insert({
    user_id: userId,
    topic_id: input.topic_id,
    scheduled_for: input.scheduled_for,
    revision_type: input.revision_type ?? "standard",
    notes: input.notes ?? ""
  }).select("*, topics(name)").single();
  if (error) throw error;
  return data as Revision;
}

export async function completeRevision(revisionId: string, result: RevisionResult, notes?: string): Promise<void> {
  const { error } = await requireSupabase().from("revisions").update({
    completed_at: new Date().toISOString(),
    result,
    ...(notes === undefined ? {} : { notes })
  }).eq("id", revisionId).is("completed_at", null);
  if (error) throw error;
}

export async function reopenRevision(revisionId: string): Promise<void> {
  const { error } = await requireSupabase().from("revisions").update({
    completed_at: null,
    result: null
  }).eq("id", revisionId);
  if (error) throw error;
}

export async function getActiveStudyPlan(): Promise<StudyPlan> {
  const client = requireSupabase();
  const { data: existing, error: listError } = await client.from("study_plans")
    .select("*").eq("is_active", true).maybeSingle();
  if (listError) throw listError;
  if (existing) return existing as StudyPlan;

  const userId = await currentUserId();
  const { data, error } = await client.from("study_plans").insert({
    user_id: userId, name: "Meu planejamento semanal", is_active: true
  }).select("*").single();

  if (!error && data) return data as StudyPlan;

  // Another tab may have created the active plan after our initial read.
  if (error?.code === "23505") {
    const { data: concurrentPlan, error: retryError } = await client.from("study_plans")
      .select("*").eq("is_active", true).maybeSingle();
    if (retryError) throw retryError;
    if (concurrentPlan) return concurrentPlan as StudyPlan;
  }

  if (error) throw error;
  throw new Error("Não foi possível carregar o planejamento ativo.");
}

export async function listStudyPlanItems(planId: string): Promise<StudyPlanItem[]> {
  const { data, error } = await requireSupabase().from("study_plan_items")
    .select("*, subjects(name), topics(name)")
    .eq("plan_id", planId)
    .order("weekday", { ascending: true })
    .order("start_time", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as StudyPlanItem[];
}

export async function createStudyPlanItem(input: StudyPlanItemInsert): Promise<StudyPlanItem> {
  const userId = await currentUserId();
  const { data, error } = await requireSupabase().from("study_plan_items").insert({
    user_id: userId,
    plan_id: input.plan_id,
    subject_id: input.subject_id ?? null,
    topic_id: input.topic_id ?? null,
    weekday: input.weekday,
    start_time: input.start_time ?? null,
    duration_minutes: input.duration_minutes,
    sort_order: input.sort_order ?? 0,
    notes: input.notes ?? ""
  }).select("*, subjects(name), topics(name)").single();
  if (error) throw error;
  return data as StudyPlanItem;
}

export async function deleteStudyPlanItem(itemId: string): Promise<void> {
  const { error } = await requireSupabase().from("study_plan_items").delete().eq("id", itemId);
  if (error) throw error;
}


export async function listMockExams(): Promise<MockExam[]> {
  const { data, error } = await requireSupabase().from("mock_exams")
    .select("*").order("exam_date", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MockExam[];
}

export async function createMockExam(input: MockExamInsert): Promise<MockExam> {
  const total = input.total_questions;
  const correct = input.correct_answers;
  const blank = input.blank_answers ?? 0;
  const incorrect = input.incorrect_answers ?? total - correct - blank;
  if (!Number.isInteger(total) || total <= 0 || !Number.isInteger(correct) || correct < 0 ||
      !Number.isInteger(incorrect) || incorrect < 0 || !Number.isInteger(blank) || blank < 0 ||
      correct + incorrect + blank !== total) {
    throw new Error("A soma de acertos, erros e questões em branco deve ser igual ao total.");
  }
  if (input.duration_minutes != null && (!Number.isInteger(input.duration_minutes) || input.duration_minutes <= 0)) {
    throw new Error("A duração do simulado deve ser um número positivo de minutos.");
  }
  const userId = await currentUserId();
  const { data, error } = await requireSupabase().from("mock_exams").insert({
    user_id: userId,
    title: input.title.trim(),
    exam_date: input.exam_date,
    examining_board: input.examining_board?.trim() || null,
    total_questions: total,
    correct_answers: correct,
    incorrect_answers: incorrect,
    blank_answers: blank,
    duration_minutes: input.duration_minutes ?? null,
    notes: input.notes ?? ""
  }).select("*").single();
  if (error) throw error;
  return data as MockExam;
}

export async function updateMockExam(examId: string, input: MockExamInsert): Promise<void> {
  const total = input.total_questions;
  const correct = input.correct_answers;
  const blank = input.blank_answers ?? 0;
  const incorrect = input.incorrect_answers ?? total - correct - blank;
  if (!input.title.trim() || !input.exam_date) throw new Error("Informe o nome e a data do simulado.");
  if (![total, correct, incorrect, blank].every(Number.isInteger) || total <= 0 || correct < 0 || incorrect < 0 || blank < 0 || correct + incorrect + blank !== total) {
    throw new Error("A soma de acertos, erros e questões em branco deve ser igual ao total.");
  }
  if (input.duration_minutes != null && (!Number.isInteger(input.duration_minutes) || input.duration_minutes <= 0)) {
    throw new Error("A duração do simulado deve ser um número positivo de minutos.");
  }
  const { error } = await requireSupabase().from("mock_exams").update({
    title: input.title.trim(), exam_date: input.exam_date,
    examining_board: input.examining_board?.trim() || null,
    total_questions: total, correct_answers: correct, incorrect_answers: incorrect,
    blank_answers: blank, duration_minutes: input.duration_minutes ?? null, notes: input.notes ?? ""
  }).eq("id", examId);
  if (error) throw error;
}

export async function deleteMockExam(examId: string): Promise<void> {
  const { error } = await requireSupabase().from("mock_exams").delete().eq("id", examId);
  if (error) throw error;
}


export async function startLegacyImport(fingerprint: string, originalFileName: string): Promise<string> {
  const userId = await currentUserId();
  const { data, error } = await requireSupabase().from("import_jobs").insert({
    user_id: userId, source: "v1_backup", file_name: fingerprint,
    status: "pending", rows_imported: 0,
    error_details: { original_file_name: originalFileName }
  }).select("id").single();
  if (error) {
    if (error.code === "23505") throw new Error("Este backup já foi processado ou teve uma tentativa iniciada. Para evitar duplicações, a importação foi bloqueada. Confira seus registros antes de qualquer nova tentativa.");
    throw error;
  }
  return data.id as string;
}

export async function finishLegacyImport(jobId: string, rowsImported: number, failed = false, details = ""): Promise<void> {
  const { error } = await requireSupabase().from("import_jobs").update({
    status: failed ? "failed" : "completed",
    rows_imported: Math.max(0, Math.floor(rowsImported)),
    error_details: details ? { message: details } : {},
    completed_at: new Date().toISOString()
  }).eq("id", jobId);
  if (error) throw error;
}

export async function listErrorNotebook(): Promise<ErrorNotebookEntry[]> {
  const { data, error } = await requireSupabase().from("error_notebook")
    .select("*, subjects(name), topics(name)").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ErrorNotebookEntry[];
}

export async function createErrorEntry(input: ErrorNotebookInsert): Promise<ErrorNotebookEntry> {
  if (!input.question_text.trim()) throw new Error("Descreva a questão ou o motivo do erro.");
  const userId = await currentUserId();
  const { data, error } = await requireSupabase().from("error_notebook").insert({
    user_id: userId,
    subject_id: input.subject_id ?? null,
    topic_id: input.topic_id ?? null,
    question_reference: input.question_reference?.trim() || null,
    question_text: input.question_text.trim(),
    user_answer: input.user_answer?.trim() || null,
    correct_answer: input.correct_answer?.trim() || null,
    explanation: input.explanation ?? "",
    tags: input.tags ?? [],
    status: input.status ?? "open"
  }).select("*, subjects(name), topics(name)").single();
  if (error) throw error;
  return data as ErrorNotebookEntry;
}

export async function updateErrorEntry(entryId: string, input: Partial<ErrorNotebookInsert>): Promise<void> {
  if (input.question_text !== undefined && !input.question_text.trim()) throw new Error("Descreva a questão ou o motivo do erro.");
  const { error } = await requireSupabase().from("error_notebook").update({
    ...(input.subject_id !== undefined && { subject_id: input.subject_id }),
    ...(input.topic_id !== undefined && { topic_id: input.topic_id }),
    ...(input.question_reference !== undefined && { question_reference: input.question_reference?.trim() || null }),
    ...(input.question_text !== undefined && { question_text: input.question_text.trim() }),
    ...(input.user_answer !== undefined && { user_answer: input.user_answer?.trim() || null }),
    ...(input.correct_answer !== undefined && { correct_answer: input.correct_answer?.trim() || null }),
    ...(input.explanation !== undefined && { explanation: input.explanation }),
    ...(input.tags !== undefined && { tags: input.tags })
  }).eq("id", entryId);
  if (error) throw error;
}

export async function updateErrorStatus(entryId: string, status: ErrorStatus): Promise<void> {
  const { error } = await requireSupabase().from("error_notebook").update({ status }).eq("id", entryId);
  if (error) throw error;
}

export async function deleteErrorEntry(entryId: string): Promise<void> {
  const { error } = await requireSupabase().from("error_notebook").delete().eq("id", entryId);
  if (error) throw error;
}

export async function listJurisprudence(): Promise<JurisprudenceEntry[]> {
  const { data, error } = await requireSupabase().from("jurisprudence_entries")
    .select("*").order("judgment_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as JurisprudenceEntry[];
}

export async function createJurisprudenceEntry(input: JurisprudenceInsert): Promise<JurisprudenceEntry> {
  if (!input.title.trim()) throw new Error("Informe o título do registro.");
  if (input.source_url && !/^https?:\/\//i.test(input.source_url)) throw new Error("A fonte deve ser um endereço HTTP ou HTTPS válido.");
  const userId = await currentUserId();
  const { data, error } = await requireSupabase().from("jurisprudence_entries").insert({
    user_id: userId,
    title: input.title.trim(),
    court: input.court?.trim() || null,
    case_reference: input.case_reference?.trim() || null,
    judgment_date: input.judgment_date ?? null,
    summary: input.summary ?? "",
    source_url: input.source_url?.trim() || null,
    tags: input.tags ?? []
  }).select("*").single();
  if (error) throw error;
  return data as JurisprudenceEntry;
}

export async function updateJurisprudenceEntry(entryId: string, input: Partial<JurisprudenceInsert>): Promise<void> {
  if (input.title !== undefined && !input.title.trim()) throw new Error("Informe o título do registro.");
  if (input.source_url && !(input.source_url.startsWith("https://") || input.source_url.startsWith("http://"))) throw new Error("A fonte deve ser um endereço HTTP ou HTTPS válido.");
  const { error } = await requireSupabase().from("jurisprudence_entries").update({
    ...(input.title !== undefined && { title: input.title.trim() }),
    ...(input.court !== undefined && { court: input.court?.trim() || null }),
    ...(input.case_reference !== undefined && { case_reference: input.case_reference?.trim() || null }),
    ...(input.judgment_date !== undefined && { judgment_date: input.judgment_date || null }),
    ...(input.summary !== undefined && { summary: input.summary }),
    ...(input.source_url !== undefined && { source_url: input.source_url?.trim() || null }),
    ...(input.tags !== undefined && { tags: input.tags })
  }).eq("id", entryId);
  if (error) throw error;
}

export async function deleteJurisprudenceEntry(entryId: string): Promise<void> {
  const { error } = await requireSupabase().from("jurisprudence_entries").delete().eq("id", entryId);
  if (error) throw error;
}
