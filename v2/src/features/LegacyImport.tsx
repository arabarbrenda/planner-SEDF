import { useMemo, useState, type ChangeEvent } from "react";
import { FileUp, ShieldCheck } from "lucide-react";
import { importLegacyV1Backup } from "../services/studyData";

type LegacyTopic = {
  id?: string; nome?: string; status?: string; checklist?: Record<string, boolean>;
  anotaçoes?: string; anotacoes?: string; questoesTotal?: number; questoesAcertos?: number;
};
type LegacySubject = { id?: string; nome?: string; prioridade?: string; icone?: string; topicos?: LegacyTopic[] };
export type LegacyData = {
  materias?: LegacySubject[];
  registrosEstudo?: Array<{ materiaId?: string; data?: string; plataforma?: string; tempo?: number; qTotal?: number; qAcertos?: number; obs?: string }>;
  simulados?: Array<{ nome?: string; data?: string; banca?: string; qTotal?: number; qAcertos?: number; tempo?: string | number; obs?: string }>;
  jurisprudencia?: Array<Record<string, unknown>>;
};

export function validateLegacyData(parsed: LegacyData): void {
  if (!Array.isArray(parsed.materias) || !Array.isArray(parsed.registrosEstudo) || !Array.isArray(parsed.simulados)) {
    throw new Error("Este arquivo não parece ser um backup JSON válido da V1.");
  }
  if (parsed.jurisprudencia !== undefined && (!Array.isArray(parsed.jurisprudencia) ||
      parsed.jurisprudencia.some(entry => !entry || typeof entry !== "object" || Array.isArray(entry)))) {
    throw new Error("A lista de jurisprudência do backup não tem um formato válido.");
  }
  if (parsed.registrosEstudo.some(session => !session || typeof session !== "object" || Array.isArray(session))) {
    throw new Error("Há uma sessão de estudo com estrutura inválida no backup.");
  }
  for (const [index, exam] of parsed.simulados.entries()) {
    if (!exam || typeof exam !== "object" || Array.isArray(exam) ||
        (exam.nome !== undefined && typeof exam.nome !== "string")) {
      throw new Error(`O simulado ${index + 1} tem uma estrutura ou um nome inválido.`);
    }
  }
  for (const [subjectIndex, subject] of parsed.materias.entries()) {
    if (!subject.nome?.trim() || !Array.isArray(subject.topicos)) {
      throw new Error(`A disciplina ${subjectIndex + 1} precisa ter nome e uma lista válida de assuntos.`);
    }
    for (const [topicIndex, topic] of subject.topicos.entries()) {
      if (!topic || typeof topic.nome !== "string" || !topic.nome.trim()) {
        throw new Error(`O assunto ${topicIndex + 1} da disciplina "${subject.nome}" está sem nome válido.`);
      }
      const total = topic.questoesTotal ?? 0;
      const correct = topic.questoesAcertos ?? 0;
      if (![total, correct].every(Number.isSafeInteger) || total < 0 || correct < 0 || correct > total) {
        throw new Error(`Os totais de questões do assunto "${topic.nome}" são inválidos. Confira o backup antes de importar.`);
      }
    }
  }
  for (const [index, exam] of parsed.simulados.entries()) {
    if (!exam || (exam.qTotal !== undefined && (!Number.isSafeInteger(exam.qTotal) || exam.qTotal < 0)) ||
        (exam.qAcertos !== undefined && (!Number.isSafeInteger(exam.qAcertos) || exam.qAcertos < 0)) ||
        (exam.qTotal !== undefined && exam.qAcertos !== undefined && exam.qAcertos > exam.qTotal)) {
      throw new Error(`Os quantitativos do simulado ${index + 1} são inválidos. Confira o backup antes de importar.`);
    }
  }
}

function asDate(value: unknown): string | undefined {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(value + "T12:00:00");
  return Number.isNaN(date.getTime()) || date.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }) !== value ? undefined : value;
}
function minutes(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}
function topicStatus(value?: string): "not_started" | "in_progress" | "review" | "completed" {
  if (value === "Concluído" || value === "Concluido" || value === "completed") return "completed";
  if (value === "Em andamento" || value === "in_progress") return "in_progress";
  if (value === "Revisar" || value === "review") return "review";
  return "not_started";
}
function priority(value?: string): "low" | "medium" | "high" {
  if (value?.toLowerCase() === "alta" || value?.toLowerCase() === "high") return "high";
  if (value?.toLowerCase() === "baixa" || value?.toLowerCase() === "low") return "low";
  return "medium";
}
function durationFromLegacy(value: unknown): number | undefined {
  if (typeof value === "number") return minutes(value);
  if (typeof value !== "string") return undefined;
  const h = value.match(/(\d+)\s*h/i);
  const m = value.match(/(\d+)\s*m/i);
  const total = Number(h?.[1] ?? 0) * 60 + Number(m?.[1] ?? 0);
  return total > 0 ? total : undefined;
}

export function LegacyImport() {
  const [data, setData] = useState<LegacyData | null>(null);
  const [fileName, setFileName] = useState("");
  const [fingerprint, setFingerprint] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const counts = useMemo(() => ({
    subjects: data?.materias?.length ?? 0,
    topics: data?.materias?.reduce((n, s) => n + (Array.isArray(s.topicos) ? s.topicos.length : 0), 0) ?? 0,
    sessions: data?.registrosEstudo?.length ?? 0,
    mocks: data?.simulados?.length ?? 0,
    jurisprudence: data?.jurisprudencia?.length ?? 0,
    questionBatches: data?.materias?.reduce((n, s) => n + (s.topicos ?? []).filter(t => Number(t.questoesTotal) > 0).length, 0) ?? 0
  }), [data]);

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setData(null); setFileName(""); setFingerprint(""); setDone(false); setConfirm(false); setError(""); setProgress("");
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError("O arquivo ultrapassa o limite de 10 MB."); return; }
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as LegacyData;
      if (!parsed || !Array.isArray(parsed.materias) || !Array.isArray(parsed.registrosEstudo) || !Array.isArray(parsed.simulados)) {
        throw new Error("Este arquivo não parece ser um backup JSON válido da V1.");
      }
      validateLegacyData(parsed);
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
      const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
      setData(parsed); setFileName(file.name); setFingerprint(hash);
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível ler o arquivo."); }
    finally { event.target.value = ""; }
  }

  async function importData() {
    if (!data || !confirm || !fingerprint) return;
    setBusy(true); setError("");
    let skippedSessions = 0, skippedMocks = 0;
    try {
      setProgress("Validando e preparando os registros...");
      const subjects = data.materias!.map((subject, index) => ({
        legacy_id: subject.id || `subject-${index}`,
        name: subject.nome!.trim(),
        icon: subject.icone || null,
        priority: priority(subject.prioridade)
      }));
      const subjectIds = new Map(data.materias!.map((subject, index) => [
        subject.id || `subject-${index}`, subject.id || `subject-${index}`
      ]));
      const topics: Array<Record<string, unknown>> = [];
      const questionAttempts: Array<Record<string, unknown>> = [];
      data.materias!.forEach((subject, subjectIndex) => {
        const subjectLegacyId = subject.id || `subject-${subjectIndex}`;
        (subject.topicos ?? []).forEach((topic, topicIndex) => {
          const topicLegacyId = topic.id || `topic-${subjectIndex}-${topicIndex}`;
          const checklist = topic.checklist ?? {};
          topics.push({
            legacy_id: topicLegacyId,
            subject_legacy_id: subjectLegacyId,
            name: topic.nome!.trim(),
            status: topicStatus(topic.status),
            annotations: topic.anotaçoes ?? topic.anotacoes ?? "",
            checklist: {
              theory: Boolean(checklist.teoria ?? checklist.theory),
              law: Boolean(checklist.lei ?? checklist.law),
              questions: Boolean(checklist.questoes ?? checklist.questions),
              errors: Boolean(checklist.erros ?? checklist.errors),
              revision: Boolean(checklist.revisao ?? checklist.revision)
            }
          });
          const total = Number(topic.questoesTotal ?? 0);
          const correct = Number(topic.questoesAcertos ?? 0);
          if (total > 0) questionAttempts.push({
            subject_legacy_id: subjectLegacyId,
            topic_legacy_id: topicLegacyId,
            total_questions: total,
            correct_answers: correct,
            notes: "Importado dos totais acumulados do tópico na V1."
          });
        });
      });
      const sessions = data.registrosEstudo!.flatMap(old => {
        const duration = minutes(old.tempo);
        const studiedOn = asDate(old.data);
        if (!duration || !studiedOn) { skippedSessions++; return []; }
        const knownSubject = old.materiaId ? subjectIds.get(old.materiaId) : undefined;
        return [{
          ...(knownSubject ? { subject_legacy_id: knownSubject } : {}),
          studied_on: studiedOn,
          duration_minutes: duration,
          platform: old.plataforma || null,
          notes: old.obs ?? "Importado da V1."
        }];
      });
      const mockExams = data.simulados!.flatMap(old => {
        const total = Number(old.qTotal ?? 0);
        const correct = Number(old.qAcertos ?? 0);
        const examDate = asDate(old.data);
        if (!old.nome?.trim() || total <= 0 || !examDate) { skippedMocks++; return []; }
        return [{
          title: old.nome.trim(),
          exam_date: examDate,
          examining_board: old.banca || null,
          total_questions: total,
          correct_answers: correct,
          incorrect_answers: total - correct,
          duration_minutes: durationFromLegacy(old.tempo) ?? null,
          notes: [old.obs, "Importado da V1; a versão anterior não armazenava separadamente questões em branco."].filter(Boolean).join(" ")
        }];
      });
      const jurisprudence = (data.jurisprudencia ?? []).flatMap(old => {
        const title = String(old.tema ?? old.titulo ?? old.title ?? old.nome ?? "").trim();
        if (!title) return [];
        const source = String(old.fonte ?? old.source_url ?? old.link ?? "").trim();
        const judgmentDate = asDate(old.data ?? old.julgamento ?? old.judgment_date);
        return [{
          title,
          court: String(old.tribunal ?? old.court ?? "").trim() || null,
          case_reference: String(old.processo ?? old.referencia ?? old.case_reference ?? "").trim() || null,
          judgment_date: judgmentDate ?? null,
          summary: String(old.tese ?? old.resumo ?? old.summary ?? old.descricao ?? ""),
          source_url: /^https?:\/\//i.test(source) ? source : null,
          tags: String(old.materia ?? "").trim() ? [String(old.materia).trim()] : []
        }];
      });
      setProgress("Enviando todos os registros em uma única transação...");
      const rowsImported = await importLegacyV1Backup(fingerprint, fileName, {
        subjects, topics, sessions, question_attempts: questionAttempts, mock_exams: mockExams, jurisprudence
      });
      setDone(true);
      setProgress(`Importação concluída: ${subjects.length} disciplinas, ${topics.length} assuntos, ${sessions.length} sessões, ${questionAttempts.length} lotes de questões, ${mockExams.length} simulados e ${jurisprudence.length} registros de jurisprudência. Ignorados: ${skippedSessions} sessões e ${skippedMocks} simulados sem data, duração ou quantidade válida. Total gravado: ${rowsImported} registros.`);
    } catch (e) {
      const failureMessage = e instanceof Error ? e.message : "Falha inesperada.";
      setError(failureMessage);
      setProgress("Nenhum registro parcial foi mantido: a operação é transacional. Se a falha foi registrada, o mesmo arquivo poderá ser tentado novamente após a correção.");
    } finally { setBusy(false); }
  }

  return <section className="detail-section legacy-import-section">
    <div className="section-heading"><div><span className="eyebrow">MIGRAÇÃO DE DADOS</span><h2>Importar backup da V1</h2><p>Traga seus dados antigos para sua conta V2, com conferência antes de iniciar.</p></div><span className="legacy-import-icon"><FileUp size={21}/></span></div>
    <div className="legacy-import-warning"><ShieldCheck size={17}/><span>O arquivo é lido no navegador e os registros são enviados para a conta autenticada. A importação adiciona dados; não apaga nem substitui registros existentes.</span></div>
    <label className="file-picker" htmlFor="legacy-backup-file">Selecionar backup JSON da V1</label>
    <input id="legacy-backup-file" type="file" accept=".json,application/json" onChange={readFile}/>
    {fileName && <p className="form-hint">Arquivo selecionado: {fileName}</p>}
    {data && <div className="legacy-preview">
      <h3>Prévia do conteúdo encontrado</h3>
      <div className="legacy-count-grid">
        <span><strong>{counts.subjects}</strong> disciplinas</span><span><strong>{counts.topics}</strong> assuntos</span>
        <span><strong>{counts.sessions}</strong> sessões</span><span><strong>{counts.questionBatches}</strong> totais de questões por assunto</span>
        <span><strong>{counts.mocks}</strong> simulados</span><span><strong>{counts.jurisprudence}</strong> itens de jurisprudência</span>
      </div>
      <ul className="form-hint">
        <li>Os totais acumulados de questões por assunto serão importados como lotes separados de questões.</li>
        <li>As questões contabilizadas dentro das sessões não serão somadas novamente, para evitar duplicidade.</li>
        <li>Simulados antigos não registravam questões em branco; serão considerados zero em branco.</li>
        <li>Planejamento/ciclo, tema visual, configurações e arquivos anexados não são migrados nesta etapa.</li>
      </ul>
      {!done && <label className="legacy-confirm"><input type="checkbox" checked={confirm} onChange={e => setConfirm(e.target.checked)}/> Entendi que os dados serão adicionados à minha conta, que não substituem registros existentes e que o mesmo arquivo não poderá ser importado novamente automaticamente.</label>}
      {!done && <button className="submit-button" disabled={!confirm || busy || !fingerprint} onClick={() => void importData()}>{busy ? "Importando..." : "Confirmar importação"}</button>}
    </div>}
    {progress && <p className="form-hint" role="status">{progress}</p>}
    {error && <p className="feedback error" role="alert">{error}</p>}
    {done && <p className="feedback success" role="status">Migração concluída. Atualize a página para recarregar os dados no painel.</p>}
  </section>;
}
