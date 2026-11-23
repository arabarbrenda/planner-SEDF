import { useMemo, useState, type ChangeEvent } from "react";
import { FileUp, ShieldCheck } from "lucide-react";
import {
  createMockExam, createQuestionAttempt, createStudySession, createSubject, createTopic, createJurisprudenceEntry
} from "../services/studyData";

type LegacyTopic = {
  id?: string; nome?: string; status?: string; checklist?: Record<string, boolean>;
  anotaçoes?: string; anotacoes?: string; questoesTotal?: number; questoesAcertos?: number;
};
type LegacySubject = { id?: string; nome?: string; prioridade?: string; icone?: string; topicos?: LegacyTopic[] };
type LegacyData = {
  materias?: LegacySubject[];
  registrosEstudo?: Array<{ materiaId?: string; data?: string; plataforma?: string; tempo?: number; qTotal?: number; qAcertos?: number; obs?: string }>;
  simulados?: Array<{ nome?: string; data?: string; banca?: string; qTotal?: number; qAcertos?: number; tempo?: string | number; obs?: string }>;
  jurisprudencia?: Array<Record<string, unknown>>;
};

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
    setData(null); setDone(false); setConfirm(false); setError(""); setProgress("");
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError("O arquivo ultrapassa o limite de 10 MB."); return; }
    try {
      const parsed = JSON.parse(await file.text()) as LegacyData;
      if (!parsed || !Array.isArray(parsed.materias) || !Array.isArray(parsed.registrosEstudo) || !Array.isArray(parsed.simulados)) {
        throw new Error("Este arquivo não parece ser um backup JSON válido da V1.");
      }
      if (parsed.materias.some(s => !s || typeof s.nome !== "string" || !Array.isArray(s.topicos))) {
        throw new Error("A estrutura das disciplinas ou dos assuntos não é válida.");
      }
      setData(parsed); setFileName(file.name);
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível ler o arquivo."); }
    finally { event.target.value = ""; }
  }

  async function importData() {
    if (!data || !confirm) return;
    setBusy(true); setError("");
    let importedSubjects = 0, importedTopics = 0, importedSessions = 0, importedQuestions = 0, importedMocks = 0, importedCases = 0, skippedSessions = 0, skippedMocks = 0;
    try {
      const subjectMap = new Map<string, string>();
      const topicMap = new Map<string, string>();
      for (const oldSubject of data.materias ?? []) {
        const subject = await createSubject({ name: oldSubject.nome!.trim(), icon: oldSubject.icone, priority: priority(oldSubject.prioridade) });
        importedSubjects++;
        if (oldSubject.id) subjectMap.set(oldSubject.id, subject.id);
        for (const oldTopic of oldSubject.topicos ?? []) {
          const checklist = oldTopic.checklist ?? {};
          const topic = await createTopic({
            subject_id: subject.id, name: (oldTopic.nome ?? "Assunto importado").trim(),
            status: topicStatus(oldTopic.status),
            annotations: oldTopic.anotaçoes ?? oldTopic.anotacoes ?? "",
            checklist: {
              theory: Boolean(checklist.teoria ?? checklist.theory),
              law: Boolean(checklist.lei ?? checklist.law),
              questions: Boolean(checklist.questoes ?? checklist.questions),
              errors: Boolean(checklist.erros ?? checklist.errors),
              revision: Boolean(checklist.revisao ?? checklist.revision)
            }
          });
          importedTopics++;
          if (oldTopic.id) topicMap.set(oldTopic.id, topic.id);
          const total = Math.max(0, Math.floor(Number(oldTopic.questoesTotal) || 0));
          const correct = Math.max(0, Math.min(total, Math.floor(Number(oldTopic.questoesAcertos) || 0)));
          if (total > 0) {
            await createQuestionAttempt({ subject_id: subject.id, topic_id: topic.id, source: "other", total_questions: total, correct_answers: correct, notes: "Importado dos totais acumulados do tópico na V1." });
            importedQuestions++;
          }
        }
        setProgress("Disciplinas e assuntos importados...");
      }
      for (const old of data.registrosEstudo ?? []) {
        const duration = minutes(old.tempo);
        const studiedOn = asDate(old.data);
        if (!duration || !studiedOn) { skippedSessions++; continue; }
        await createStudySession({
          subject_id: old.materiaId ? subjectMap.get(old.materiaId) : undefined,
          studied_on: studiedOn,
          duration_minutes: duration, platform: old.plataforma,
          notes: old.obs ?? "Importado da V1."
        });
        importedSessions++;
        setProgress("Histórico de sessões importado...");
      }
      for (const old of data.simulados ?? []) {
        const total = Math.max(0, Math.floor(Number(old.qTotal) || 0));
        const correct = Math.max(0, Math.min(total, Math.floor(Number(old.qAcertos) || 0)));
        const examDate = asDate(old.data);
        if (!old.nome?.trim() || total <= 0 || !examDate) { skippedMocks++; continue; }
        await createMockExam({
          title: old.nome.trim(), exam_date: examDate,
          examining_board: old.banca, total_questions: total, correct_answers: correct,
          incorrect_answers: total - correct, blank_answers: 0,
          duration_minutes: durationFromLegacy(old.tempo),
          notes: [old.obs, "Importado da V1; a versão anterior não armazenava separadamente questões em branco."].filter(Boolean).join(" ")
        });
        importedMocks++;
      }
      for (const old of data.jurisprudencia ?? []) {
        const title = String(old.tema ?? old.titulo ?? old.title ?? old.nome ?? "").trim();
        if (!title) continue;
        const source = String(old.fonte ?? old.source_url ?? old.link ?? "").trim();
        await createJurisprudenceEntry({
          title, court: String(old.tribunal ?? old.court ?? "").trim() || undefined,
          case_reference: String(old.processo ?? old.referencia ?? old.case_reference ?? "").trim() || undefined,
          judgment_date: asDate(old.data ?? old.julgamento ?? old.judgment_date),
          summary: String(old.tese ?? old.resumo ?? old.summary ?? old.descricao ?? ""),
          source_url: /^https?:\/\//i.test(source) ? source : undefined,
          tags: String(old.materia ?? "").trim() ? [String(old.materia).trim()] : []
        });
        importedCases++;
      }
      setProgress("Importação concluída.");
      setDone(true);
      setProgress("Importados: " + importedSubjects + " disciplinas, " + importedTopics + " assuntos, " + importedSessions + " sessões, " + importedQuestions + " lotes de questões, " + importedMocks + " simulados e " + importedCases + " registros de jurisprudência. Ignorados: " + skippedSessions + " sessões e " + skippedMocks + " simulados sem data, duração ou quantidade válida.");
    } catch (e) {
      setError((e instanceof Error ? e.message : "Falha inesperada.") + " A importação pode ter sido parcial. Confira os dados antes de tentar novamente.");
      setProgress("Até a falha: " + importedSubjects + " disciplinas, " + importedTopics + " assuntos, " + importedSessions + " sessões, " + importedQuestions + " lotes de questões, " + importedMocks + " simulados e " + importedCases + " registros de jurisprudência.");
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
      {!done && <label className="legacy-confirm"><input type="checkbox" checked={confirm} onChange={e => setConfirm(e.target.checked)}/> Entendi que os dados serão adicionados à minha conta e que a operação não substitui registros existentes.</label>}
      {!done && <button className="submit-button" disabled={!confirm || busy} onClick={() => void importData()}>{busy ? "Importando..." : "Confirmar importação"}</button>}
    </div>}
    {progress && <p className="form-hint" role="status">{progress}</p>}
    {error && <p className="feedback error" role="alert">{error}</p>}
    {done && <p className="feedback success" role="status">Migração concluída. Atualize a página para recarregar os dados no painel.</p>}
  </section>;
}
