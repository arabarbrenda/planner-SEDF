export type Priority = "low" | "medium" | "high";
export type TopicStatus = "not_started" | "in_progress" | "review" | "completed";

export type Subject = {
  id: string;
  user_id: string;
  name: string;
  icon: string | null;
  priority: Priority;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type TopicChecklist = {
  theory: boolean;
  law: boolean;
  questions: boolean;
  errors: boolean;
  revision: boolean;
};

export type Topic = {
  id: string;
  user_id: string;
  subject_id: string;
  parent_topic_id: string | null;
  name: string;
  status: TopicStatus;
  priority: Priority | null;
  annotations: string;
  checklist: TopicChecklist;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type StudySession = {
  id: string;
  user_id: string;
  subject_id: string | null;
  topic_id: string | null;
  studied_on: string;
  duration_minutes: number;
  platform: string | null;
  notes: string;
  created_at: string;
};

export type QuestionAttempt = {
  id: string;
  user_id: string;
  subject_id: string | null;
  topic_id: string | null;
  attempted_on: string;
  platform: string | null;
  source: "manual" | "tec_import" | "mock_exam" | "other";
  total_questions: number;
  correct_answers: number;
  incorrect_answers: number;
  blank_answers: number;
  notes: string;
  external_reference: string | null;
  created_at: string;
};

export type SubjectInsert = Pick<Subject, "name"> & Partial<Pick<Subject, "icon" | "priority" | "sort_order">>;
export type TopicInsert = Pick<Topic, "subject_id" | "name"> & Partial<Pick<Topic, "parent_topic_id" | "status" | "priority" | "annotations" | "checklist" | "sort_order">>;
export type StudySessionInsert = Pick<StudySession, "duration_minutes"> & Partial<Pick<StudySession, "subject_id" | "topic_id" | "studied_on" | "platform" | "notes">>;
export type QuestionAttemptInsert = Pick<QuestionAttempt, "total_questions" | "correct_answers"> & Partial<Pick<QuestionAttempt, "subject_id" | "topic_id" | "attempted_on" | "platform" | "source" | "incorrect_answers" | "blank_answers" | "notes" | "external_reference">>;

export type RevisionResult = "easy" | "medium" | "hard" | "again";
export type Revision = {
  id: string;
  user_id: string;
  topic_id: string;
  scheduled_for: string;
  completed_at: string | null;
  revision_type: string;
  result: RevisionResult | null;
  notes: string;
  created_at: string;
  topics?: { name: string } | null;
};
export type RevisionInsert = Pick<Revision, "topic_id" | "scheduled_for"> & Partial<Pick<Revision, "revision_type" | "notes">>;

export type StudyPlan = {
  id: string;
  user_id: string;
  name: string;
  is_active: boolean;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};
export type StudyPlanItem = {
  id: string;
  user_id: string;
  plan_id: string;
  subject_id: string | null;
  topic_id: string | null;
  weekday: number | null;
  start_time: string | null;
  duration_minutes: number;
  sort_order: number;
  notes: string;
  subjects?: { name: string } | null;
  topics?: { name: string } | null;
};
export type StudyPlanItemInsert = Pick<StudyPlanItem, "plan_id" | "weekday" | "duration_minutes"> & Partial<Pick<StudyPlanItem, "subject_id" | "topic_id" | "start_time" | "sort_order" | "notes">>;

export type MockExam = {
  id: string;
  user_id: string;
  title: string;
  exam_date: string;
  examining_board: string | null;
  total_questions: number;
  correct_answers: number;
  incorrect_answers: number;
  blank_answers: number;
  duration_minutes: number | null;
  notes: string;
  created_at: string;
};
export type MockExamInsert = Pick<MockExam, "title" | "exam_date" | "total_questions" | "correct_answers"> &
  Partial<Pick<MockExam, "examining_board" | "incorrect_answers" | "blank_answers" | "duration_minutes" | "notes">>;


export type ErrorStatus = "open" | "reviewing" | "resolved";
export type ErrorNotebookEntry = {
  id: string;
  user_id: string;
  subject_id: string | null;
  topic_id: string | null;
  question_reference: string | null;
  question_text: string;
  user_answer: string | null;
  correct_answer: string | null;
  explanation: string;
  tags: string[];
  status: ErrorStatus;
  created_at: string;
  updated_at: string;
  subjects?: { name: string } | null;
  topics?: { name: string } | null;
};
export type ErrorNotebookInsert = Pick<ErrorNotebookEntry, "question_text"> &
  Partial<Pick<ErrorNotebookEntry, "subject_id" | "topic_id" | "question_reference" | "user_answer" | "correct_answer" | "explanation" | "tags" | "status">>;
export type JurisprudenceEntry = {
  id: string;
  user_id: string;
  title: string;
  court: string | null;
  case_reference: string | null;
  judgment_date: string | null;
  summary: string;
  source_url: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
};
export type JurisprudenceInsert = Pick<JurisprudenceEntry, "title"> &
  Partial<Pick<JurisprudenceEntry, "court" | "case_reference" | "judgment_date" | "summary" | "source_url" | "tags">>;
