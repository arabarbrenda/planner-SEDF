import { useCallback, useEffect, useState, type FormEvent } from "react";
import { BookOpen, Clock3, ListChecks, Plus, RefreshCw, Target } from "lucide-react";
import { createSubject, getStudySummary, listSubjects } from "../services/studyData";
import type { Subject } from "../types/database";

export function StudyHome({ email }: { email: string }) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [summary, setSummary] = useState({ subjectCount: 0, studyMinutes: 0, totalQuestions: 0, correctAnswers: 0, accuracy: null as number | null });
  const [name, setName] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [nextSubjects, nextSummary] = await Promise.all([listSubjects(), getStudySummary()]);
      setSubjects(nextSubjects);
      setSummary(nextSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar seus dados.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function handleCreateSubject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true); setError("");
    try {
      await createSubject({ name: name.trim() });
      setName(""); setShowForm(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar a disciplina.");
    } finally {
      setSaving(false);
    }
  }

  const hours = Math.floor(summary.studyMinutes / 60);
  const minutes = summary.studyMinutes % 60;

  return <main className="workspace">
    <header className="workspace-header">
      <div><div className="brand"><span className="brand-mark"><BookOpen size={20}/></span> planner <b>da bre</b><span className="brand-version">V2</span></div><p className="workspace-kicker">SEU ESPAÇO DE ESTUDOS</p></div>
      <div className="user-chip"><span className="user-dot"/><span>{email}</span></div>
    </header>
    <section className="workspace-content">
      <div className="welcome-row"><div><span className="eyebrow">SEU PRÓXIMO CAPÍTULO</span><h1>Vamos avançar no seu ritmo.</h1><p>Um passo consistente de cada vez. Seu progresso começa aqui.</p></div><button className="refresh-button" onClick={()=>void refresh()} aria-label="Atualizar dados" disabled={loading}><RefreshCw size={17}/></button></div>
      {error && <p className="feedback error" role="alert">{error}</p>}
      <div className="metric-grid">
        <article className="metric-card"><span className="metric-icon"><BookOpen size={18}/></span><span className="metric-label">DISCIPLINAS</span><strong>{loading ? "—" : summary.subjectCount}</strong><small>na sua preparação</small></article>
        <article className="metric-card"><span className="metric-icon"><Clock3 size={18}/></span><span className="metric-label">TEMPO DE ESTUDO</span><strong>{loading ? "—" : `${hours}h ${minutes}min`}</strong><small>registrado em sessões</small></article>
        <article className="metric-card"><span className="metric-icon"><ListChecks size={18}/></span><span className="metric-label">QUESTÕES</span><strong>{loading ? "—" : summary.totalQuestions}</strong><small>{summary.correctAnswers} acertos registrados</small></article>
        <article className="metric-card"><span className="metric-icon"><Target size={18}/></span><span className="metric-label">APROVEITAMENTO</span><strong>{loading ? "—" : summary.accuracy === null ? "—" : `${summary.accuracy}%`}</strong><small>{summary.accuracy === null ? "sem tentativas registradas" : "sobre questões respondidas"}</small></article>
      </div>
      <section className="subjects-section">
        <div className="section-heading"><div><span className="eyebrow">ORGANIZE SUA PREPARAÇÃO</span><h2>Suas disciplinas</h2><p>Monte sua estrutura de estudos para começar.</p></div><button className="add-button" onClick={()=>setShowForm(v=>!v)}><Plus size={17}/>{showForm ? "Fechar" : "Nova disciplina"}</button></div>
        {showForm && <form className="subject-form" onSubmit={handleCreateSubject}><label htmlFor="subject-name">Nome da disciplina</label><input id="subject-name" value={name} onChange={e=>setName(e.target.value)} placeholder="Ex.: Língua Portuguesa" maxLength={100} required/><button className="submit-button" type="submit" disabled={saving || !name.trim()}>{saving ? "Salvando..." : "Adicionar disciplina"}</button></form>}
        {loading ? <div className="empty-state">Carregando suas disciplinas...</div> : subjects.length === 0 ? <div className="empty-state"><span className="empty-icon"><BookOpen size={23}/></span><h3>Sua jornada começa por aqui.</h3><p>Adicione a primeira disciplina para organizar os assuntos do edital.</p><button className="text-link" onClick={()=>setShowForm(true)}>Adicionar primeira disciplina</button></div> : <div className="subject-grid">{subjects.map(subject=><article className="subject-card" key={subject.id}><span className="subject-symbol"><BookOpen size={18}/></span><h3>{subject.name}</h3><span className={`priority priority-${subject.priority}`}>{subject.priority === "high" ? "Alta prioridade" : subject.priority === "low" ? "Baixa prioridade" : "Prioridade média"}</span></article>)}</div>}
      </section>
      <footer className="workspace-footer">PLANNER DA BRE V2 <span>·</span> SEUS DADOS SINCRONIZADOS COM SEGURANÇA</footer>
    </section>
  </main>;
}