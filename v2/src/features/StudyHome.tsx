import { useCallback, useEffect, useState, type FormEvent } from "react";
import { BookOpen, Clock3, ListChecks, Plus, RefreshCw, Target, GraduationCap, Timer, CheckCircle2, CalendarDays, Trash2, CalendarRange } from "lucide-react";
import { completeRevision, createQuestionAttempt, createRevision, createStudyPlanItem, createStudySession, createSubject, createTopic, deleteStudyPlanItem, getActiveStudyPlan, getStudySummary, listRevisions, listStudyPlanItems, listSubjects, listTopics, updateTopicStatus } from "../services/studyData";
import type { Revision, RevisionResult, StudyPlan, StudyPlanItem, Subject, Topic, TopicStatus } from "../types/database";

const statusLabels: Record<TopicStatus, string> = {
  not_started: "Não iniciado",
  in_progress: "Em andamento",
  review: "Revisar",
  completed: "Concluído"
};

export function StudyHome({ email }: { email: string }) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [allTopics, setAllTopics] = useState<Topic[]>([]);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [activePlan, setActivePlan] = useState<StudyPlan | null>(null);
  const [planItems, setPlanItems] = useState<StudyPlanItem[]>([]);
  const [planWeekday, setPlanWeekday] = useState("1");
  const [planSubject, setPlanSubject] = useState("");
  const [planTopic, setPlanTopic] = useState("");
  const [planTime, setPlanTime] = useState("14:00");
  const [planDuration, setPlanDuration] = useState("60");
  const [planNotes, setPlanNotes] = useState("");
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [revisionTopic, setRevisionTopic] = useState("");
  const [revisionDate, setRevisionDate] = useState(new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }));
  const [revisionResult, setRevisionResult] = useState<RevisionResult>("medium");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [summary, setSummary] = useState({ subjectCount: 0, studyMinutes: 0, totalQuestions: 0, correctAnswers: 0, accuracy: null as number | null });
  const [name, setName] = useState("");
  const [topicName, setTopicName] = useState("");
  const [duration, setDuration] = useState("60");
  const [sessionNotes, setSessionNotes] = useState("");
  const [questionTotal, setQuestionTotal] = useState("10");
  const [questionCorrect, setQuestionCorrect] = useState("7");
  const [questionNotes, setQuestionNotes] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showTopicForm, setShowTopicForm] = useState(false);
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [nextSubjects, nextSummary, nextRevisions, nextTopics, nextPlan] = await Promise.all([listSubjects(), getStudySummary(), listRevisions(), listTopics(), getActiveStudyPlan()]);
      setSubjects(nextSubjects);
      setSummary(nextSummary);
      setRevisions(nextRevisions);
      setAllTopics(nextTopics);
      setActivePlan(nextPlan);
      setPlanItems(await listStudyPlanItems(nextPlan.id));
      if (selectedSubject && !nextSubjects.some(s => s.id === selectedSubject)) setSelectedSubject("");
      if (selectedSubject) setTopics(await listTopics(selectedSubject));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar seus dados.");
    } finally { setLoading(false); }
  }, [selectedSubject]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function selectSubject(id: string) {
    setSelectedSubject(id); setError(""); setNotice("");
    try { setTopics(await listTopics(id)); }
    catch (err) { setError(err instanceof Error ? err.message : "Não foi possível carregar os assuntos."); }
  }

  async function handleCreateSubject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!name.trim()) return;
    setSaving(true); setError("");
    try {
      const created = await createSubject({ name: name.trim() });
      setName(""); setShowForm(false); setNotice("Disciplina adicionada!");
      await refresh(); await selectSubject(created.id);
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível criar a disciplina."); }
    finally { setSaving(false); }
  }

  async function handleCreateTopic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!topicName.trim() || !selectedSubject) return;
    setSaving(true); setError("");
    try {
      await createTopic({ subject_id: selectedSubject, name: topicName.trim() });
      setTopicName(""); setShowTopicForm(false); setNotice("Assunto adicionado!");
      setTopics(await listTopics(selectedSubject));
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível criar o assunto."); }
    finally { setSaving(false); }
  }

  async function handleStatus(topicId: string, status: TopicStatus) {
    setError("");
    try { await updateTopicStatus(topicId, status); setTopics(await listTopics(selectedSubject)); }
    catch (err) { setError(err instanceof Error ? err.message : "Não foi possível atualizar o assunto."); }
  }

  async function handleCreatePlanItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activePlan || !planSubject) { setError("Selecione uma disciplina para o bloco de estudo."); return; }
    const mins = Number(planDuration);
    if (!Number.isInteger(mins) || mins < 5 || mins > 720) { setError("A duração deve ficar entre 5 e 720 minutos."); return; }
    setSaving(true); setError("");
    try {
      await createStudyPlanItem({ plan_id: activePlan.id, weekday: Number(planWeekday), subject_id: planSubject, topic_id: planTopic || undefined, start_time: planTime || undefined, duration_minutes: mins, notes: planNotes.trim() });
      setShowPlanForm(false); setPlanNotes(""); setNotice("Bloco adicionado ao planejamento!"); setPlanItems(await listStudyPlanItems(activePlan.id));
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível adicionar o bloco."); }
    finally { setSaving(false); }
  }

  async function handleDeletePlanItem(id: string) {
    try { await deleteStudyPlanItem(id); if (activePlan) setPlanItems(await listStudyPlanItems(activePlan.id)); setNotice("Bloco removido do planejamento."); }
    catch (err) { setError(err instanceof Error ? err.message : "Não foi possível remover o bloco."); }
  }

  async function handleCreateRevision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!revisionTopic || !revisionDate) { setError("Selecione um assunto e a data da revisão."); return; }
    setSaving(true); setError("");
    try {
      await createRevision({ topic_id: revisionTopic, scheduled_for: revisionDate });
      setShowRevisionForm(false); setNotice("Revisão agendada!"); setRevisions(await listRevisions());
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível agendar a revisão."); }
    finally { setSaving(false); }
  }

  async function handleCompleteRevision(id: string) {
    setError("");
    try { await completeRevision(id, revisionResult); setRevisions(await listRevisions()); setNotice("Revisão concluída!"); }
    catch (err) { setError(err instanceof Error ? err.message : "Não foi possível concluir a revisão."); }
  }

  async function handleSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const mins = Number(duration);
    if (!Number.isInteger(mins) || mins <= 0 || mins > 1440) { setError("Informe uma duração entre 1 e 1.440 minutos."); return; }
    setSaving(true); setError("");
    try {
      await createStudySession({ subject_id: selectedSubject || undefined, duration_minutes: mins, notes: sessionNotes.trim() });
      setSessionNotes(""); setShowSessionForm(false); setNotice("Sessão de estudo registrada!"); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível registrar a sessão."); }
    finally { setSaving(false); }
  }

  async function handleQuestions(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const total = Number(questionTotal), correct = Number(questionCorrect);
    if (!Number.isInteger(total) || !Number.isInteger(correct) || total <= 0 || correct < 0 || correct > total) {
      setError("Confira o total de questões e a quantidade de acertos."); return;
    }
    setSaving(true); setError("");
    try {
      await createQuestionAttempt({ subject_id: selectedSubject || undefined, total_questions: total, correct_answers: correct, source: "manual", notes: questionNotes.trim() });
      setQuestionNotes(""); setShowQuestionForm(false); setNotice("Desempenho registrado!"); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível registrar as questões."); }
    finally { setSaving(false); }
  }

  const hours = Math.floor(summary.studyMinutes / 60);
  const minutes = summary.studyMinutes % 60;
  const activeSubject = subjects.find(s => s.id === selectedSubject);

  return <main className="workspace">
    <header className="workspace-header">
      <div><div className="brand"><span className="brand-mark"><BookOpen size={20}/></span> planner <b>da bre</b><span className="brand-version">V2</span></div><p className="workspace-kicker">SEU ESPAÇO DE ESTUDOS</p></div>
      <div className="user-chip"><span className="user-dot"/><span>{email}</span></div>
    </header>
    <section className="workspace-content">
      <div className="welcome-row"><div><span className="eyebrow">SEU PRÓXIMO CAPÍTULO</span><h1>Vamos avançar no seu ritmo.</h1><p>Um passo consistente de cada vez. Seu progresso começa aqui.</p></div><button className="refresh-button" onClick={()=>void refresh()} aria-label="Atualizar dados" disabled={loading}><RefreshCw size={17}/></button></div>
      {error && <p className="feedback error" role="alert">{error}</p>}
      {notice && <p className="feedback success" role="status">{notice}</p>}
      <div className="metric-grid">
        <article className="metric-card"><span className="metric-icon"><BookOpen size={18}/></span><span className="metric-label">DISCIPLINAS</span><strong>{loading ? "—" : summary.subjectCount}</strong><small>na sua preparação</small></article>
        <article className="metric-card"><span className="metric-icon"><Clock3 size={18}/></span><span className="metric-label">TEMPO DE ESTUDO</span><strong>{loading ? "—" : `${hours}h ${minutes}min`}</strong><small>registrado em sessões</small></article>
        <article className="metric-card"><span className="metric-icon"><ListChecks size={18}/></span><span className="metric-label">QUESTÕES</span><strong>{loading ? "—" : summary.totalQuestions}</strong><small>{summary.correctAnswers} acertos registrados</small></article>
        <article className="metric-card"><span className="metric-icon"><Target size={18}/></span><span className="metric-label">APROVEITAMENTO</span><strong>{loading ? "—" : summary.accuracy === null ? "—" : `${summary.accuracy}%`}</strong><small>{summary.accuracy === null ? "sem tentativas registradas" : "sobre questões respondidas"}</small></article>
      </div>
      <section className="subjects-section">
        <div className="section-heading"><div><span className="eyebrow">ORGANIZE SUA PREPARAÇÃO</span><h2>Suas disciplinas</h2><p>Escolha uma disciplina para organizar os assuntos.</p></div><button className="add-button" onClick={()=>setShowForm(v=>!v)}><Plus size={17}/>{showForm ? "Fechar" : "Nova disciplina"}</button></div>
        {showForm && <form className="subject-form" onSubmit={handleCreateSubject}><label htmlFor="subject-name">Nome da disciplina</label><input id="subject-name" value={name} onChange={e=>setName(e.target.value)} placeholder="Ex.: Língua Portuguesa" maxLength={100} required/><button className="submit-button" type="submit" disabled={saving || !name.trim()}>{saving ? "Salvando..." : "Adicionar disciplina"}</button></form>}
        {loading ? <div className="empty-state">Carregando suas disciplinas...</div> : subjects.length === 0 ? <div className="empty-state"><span className="empty-icon"><BookOpen size={23}/></span><h3>Sua jornada começa por aqui.</h3><p>Adicione a primeira disciplina para organizar os assuntos do edital.</p><button className="text-link" onClick={()=>setShowForm(true)}>Adicionar primeira disciplina</button></div> : <div className="subject-grid">{subjects.map(subject=><button type="button" className={`subject-card subject-select ${selectedSubject === subject.id ? "selected" : ""}`} key={subject.id} onClick={()=>void selectSubject(subject.id)}><span className="subject-symbol"><BookOpen size={18}/></span><h3>{subject.name}</h3><span className={`priority priority-${subject.priority}`}>{subject.priority === "high" ? "Alta prioridade" : subject.priority === "low" ? "Baixa prioridade" : "Prioridade média"}</span></button>)}</div>}
      </section>
      {activeSubject && <section className="detail-section">
        <div className="section-heading"><div><span className="eyebrow">CONTEÚDO PROGRAMÁTICO</span><h2>{activeSubject.name}</h2><p>Cadastre os assuntos e acompanhe seu andamento.</p></div><button className="add-button" onClick={()=>setShowTopicForm(v=>!v)}><Plus size={17}/>{showTopicForm ? "Fechar" : "Novo assunto"}</button></div>
        {showTopicForm && <form className="subject-form" onSubmit={handleCreateTopic}><label htmlFor="topic-name">Nome do assunto</label><input id="topic-name" value={topicName} onChange={e=>setTopicName(e.target.value)} placeholder="Ex.: Interpretação de textos" maxLength={180} required/><button className="submit-button" type="submit" disabled={saving || !topicName.trim()}>{saving ? "Salvando..." : "Adicionar assunto"}</button></form>}
        {topics.length === 0 ? <div className="empty-state"><span className="empty-icon"><GraduationCap size={23}/></span><h3>Nenhum assunto cadastrado ainda.</h3><p>Comece adicionando um tópico do edital desta disciplina.</p></div> : <div className="topic-list">{topics.map(topic=><article className="topic-row" key={topic.id}><div><strong>{topic.name}</strong><small>{topic.priority ? `Prioridade ${topic.priority === "high" ? "alta" : topic.priority === "low" ? "baixa" : "média"}` : "Assunto do edital"}</small></div><select aria-label={`Status de ${topic.name}`} value={topic.status} onChange={e=>void handleStatus(topic.id,e.target.value as TopicStatus)}>{(Object.keys(statusLabels) as TopicStatus[]).map(status=><option value={status} key={status}>{statusLabels[status]}</option>)}</select></article>)}</div>}
        <div className="quick-actions"><button className="action-card" onClick={()=>setShowSessionForm(v=>!v)}><Timer size={18}/><span><b>Registrar estudo</b><small>Adicionar tempo estudado</small></span></button><button className="action-card" onClick={()=>setShowQuestionForm(v=>!v)}><CheckCircle2 size={18}/><span><b>Registrar questões</b><small>Salvar seu desempenho</small></span></button></div>
        {showSessionForm && <form className="entry-form" onSubmit={handleSession}><h3>Nova sessão de estudo</h3><label htmlFor="session-duration">Duração em minutos</label><input id="session-duration" type="number" min="1" max="1440" value={duration} onChange={e=>setDuration(e.target.value)} required/><label htmlFor="session-notes">Observações (opcional)</label><input id="session-notes" value={sessionNotes} onChange={e=>setSessionNotes(e.target.value)} maxLength={1000} placeholder="O que você estudou?"/><button className="submit-button" disabled={saving}>{saving ? "Salvando..." : "Salvar sessão"}</button></form>}
        {showQuestionForm && <form className="entry-form" onSubmit={handleQuestions}><h3>Desempenho em questões</h3><label htmlFor="questions-total">Total de questões</label><input id="questions-total" type="number" min="1" value={questionTotal} onChange={e=>setQuestionTotal(e.target.value)} required/><label htmlFor="questions-correct">Quantidade de acertos</label><input id="questions-correct" type="number" min="0" max={questionTotal} value={questionCorrect} onChange={e=>setQuestionCorrect(e.target.value)} required/><label htmlFor="questions-notes">Observações (opcional)</label><input id="questions-notes" value={questionNotes} onChange={e=>setQuestionNotes(e.target.value)} maxLength={1000} placeholder="Banca, assunto, dificuldades..."/><button className="submit-button" disabled={saving}>{saving ? "Salvando..." : "Salvar desempenho"}</button></form>}
      </section>}
      <section className="detail-section plan-section">
        <div className="section-heading"><div><span className="eyebrow">ROTINA COM INTENÇÃO</span><h2>Planejamento semanal</h2><p>Monte seus blocos de estudo por dia, horário e disciplina.</p></div><button className="add-button" onClick={()=>setShowPlanForm(v=>!v)}><Plus size={17}/>{showPlanForm ? "Fechar" : "Adicionar bloco"}</button></div>
        {showPlanForm && <form className="entry-form plan-form" onSubmit={handleCreatePlanItem}><h3>Novo bloco de estudo</h3><label htmlFor="plan-weekday">Dia da semana</label><select id="plan-weekday" value={planWeekday} onChange={e=>setPlanWeekday(e.target.value)}>{["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"].map((day,index)=><option value={String(index)} key={day}>{day}</option>)}</select><label htmlFor="plan-subject">Disciplina</label><select id="plan-subject" value={planSubject} onChange={e=>{setPlanSubject(e.target.value);setPlanTopic("");}} required><option value="">Selecione</option>{subjects.map(subject=><option value={subject.id} key={subject.id}>{subject.name}</option>)}</select><label htmlFor="plan-topic">Assunto (opcional)</label><select id="plan-topic" value={planTopic} onChange={e=>setPlanTopic(e.target.value)}><option value="">Sem assunto específico</option>{allTopics.filter(topic=>topic.subject_id===planSubject).map(topic=><option value={topic.id} key={topic.id}>{topic.name}</option>)}</select><label htmlFor="plan-time">Horário de início</label><input id="plan-time" type="time" value={planTime} onChange={e=>setPlanTime(e.target.value)}/><label htmlFor="plan-duration">Duração (minutos)</label><input id="plan-duration" type="number" min="5" max="720" value={planDuration} onChange={e=>setPlanDuration(e.target.value)} required/><label htmlFor="plan-notes">Observações (opcional)</label><input id="plan-notes" value={planNotes} onChange={e=>setPlanNotes(e.target.value)} maxLength={500} placeholder="Ex.: teoria + questões"/><button className="submit-button" disabled={saving || !planSubject}>{saving ? "Salvando..." : "Salvar bloco"}</button></form>}
        <div className="week-grid">{["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"].map((day,index)=>{const dayItems=planItems.filter(item=>item.weekday===index);return <article className="week-day" key={day}><div className="week-day-heading"><strong>{day}</strong><span>{dayItems.reduce((sum,item)=>sum+item.duration_minutes,0)} min</span></div>{dayItems.length===0?<p className="week-empty">Sem blocos programados</p>:dayItems.map(item=><div className="plan-item" key={item.id}><div className="plan-item-time">{item.start_time?.slice(0,5) ?? "Horário livre"} · {item.duration_minutes} min</div><strong>{item.subjects?.name ?? "Disciplina"}</strong>{item.topics?.name && <small>{item.topics.name}</small>}{item.notes && <small>{item.notes}</small>}<button type="button" className="remove-plan-item" onClick={()=>void handleDeletePlanItem(item.id)} aria-label="Remover bloco"><Trash2 size={14}/></button></div>)}</article>})}</div>
        <div className="week-total"><CalendarRange size={16}/> <span>Total programado na semana: <strong>{planItems.reduce((sum,item)=>sum+item.duration_minutes,0)} minutos</strong> ({(planItems.reduce((sum,item)=>sum+item.duration_minutes,0)/60).toFixed(1)} h)</span></div>
      </section>
      <section className="detail-section revision-section">
        <div className="section-heading"><div><span className="eyebrow">MEMÓRIA DE LONGO PRAZO</span><h2>Revisões</h2><p>Acompanhe o que precisa ser revisado e registre sua evolução.</p></div><button className="add-button" onClick={()=>setShowRevisionForm(v=>!v)}><Plus size={17}/>{showRevisionForm ? "Fechar" : "Agendar revisão"}</button></div>
        {showRevisionForm && <form className="entry-form" onSubmit={handleCreateRevision}><h3>Agendar uma revisão</h3><label htmlFor="revision-topic">Assunto</label><select id="revision-topic" value={revisionTopic} onChange={e=>setRevisionTopic(e.target.value)} required><option value="">Selecione um assunto</option>{subjects.flatMap(subject=>allTopics.filter(topic=>topic.subject_id===subject.id).map(topic=><option value={topic.id} key={topic.id}>{subject.name} — {topic.name}</option>))}</select><label htmlFor="revision-date">Data da revisão</label><input id="revision-date" type="date" value={revisionDate} onChange={e=>setRevisionDate(e.target.value)} required/><button className="submit-button" disabled={saving || !revisionTopic}>{saving ? "Salvando..." : "Agendar revisão"}</button><small className="form-hint">Selecione qualquer assunto já cadastrado em suas disciplinas.</small></form>}
        {revisions.length === 0 ? <div className="empty-state"><span className="empty-icon"><CalendarDays size={23}/></span><h3>Nenhuma revisão agendada.</h3><p>Cadastre assuntos e programe revisões para acompanhar sua retenção.</p></div> : <div className="revision-list">{revisions.map(revision=>{const today=new Date().toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"});const done=Boolean(revision.completed_at);const due=revision.scheduled_for<today?"Atrasada":revision.scheduled_for===today?"Hoje":"Programada";return <article className={`revision-row ${done?"revision-done":revision.scheduled_for<today?"revision-overdue":""}`} key={revision.id}><div className="revision-main"><span className="revision-date">{new Date(revision.scheduled_for+"T12:00:00").toLocaleDateString("pt-BR")}</span><strong>{revision.topics?.name ?? "Assunto indisponível"}</strong><small>{done ? `Concluída · resultado: ${revision.result ?? "não informado"}` : due}</small></div>{done ? <span className="revision-completed"><CheckCircle2 size={15}/> Concluída</span> : <div className="revision-controls"><select aria-label="Resultado da revisão" value={revisionResult} onChange={e=>setRevisionResult(e.target.value as RevisionResult)}><option value="easy">Fácil</option><option value="medium">Médio</option><option value="hard">Difícil</option><option value="again">Preciso rever</option></select><button type="button" className="complete-button" onClick={()=>void handleCompleteRevision(revision.id)}>Concluir</button></div>}</article>})}</div>}
      </section>
      <footer className="workspace-footer">PLANNER DA BRE V2 <span>·</span> SEUS DADOS SINCRONIZADOS COM SEGURANÇA</footer>
    </section>
  </main>;
}
