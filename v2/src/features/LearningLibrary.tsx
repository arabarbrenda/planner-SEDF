import { useEffect, useState, type FormEvent } from "react";
import { FileWarning, Plus, Scale, Trash2 } from "lucide-react";
import {
  createErrorEntry, createJurisprudenceEntry, deleteErrorEntry, deleteJurisprudenceEntry,
  listErrorNotebook, listJurisprudence, updateErrorStatus
} from "../services/studyData";
import type { ErrorNotebookEntry, ErrorStatus, JurisprudenceEntry, Subject, Topic } from "../types/database";

export function LearningLibrary({ subjects, topics }: { subjects: Subject[]; topics: Topic[] }) {
  const [errors, setErrors] = useState<ErrorNotebookEntry[]>([]);
  const [cases, setCases] = useState<JurisprudenceEntry[]>([]);
  const [errorForm, setErrorForm] = useState(false);
  const [caseForm, setCaseForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [reference, setReference] = useState("");
  const [question, setQuestion] = useState("");
  const [myAnswer, setMyAnswer] = useState("");
  const [rightAnswer, setRightAnswer] = useState("");
  const [explanation, setExplanation] = useState("");
  const [tags, setTags] = useState("");
  const [title, setTitle] = useState("");
  const [court, setCourt] = useState("");
  const [caseRef, setCaseRef] = useState("");
  const [judgmentDate, setJudgmentDate] = useState("");
  const [summary, setSummary] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [errorSearch, setErrorSearch] = useState("");
  const [errorStatusFilter, setErrorStatusFilter] = useState("all");
  const [caseSearch, setCaseSearch] = useState("");

  async function refresh() {
    const [nextErrors, nextCases] = await Promise.all([listErrorNotebook(), listJurisprudence()]);
    setErrors(nextErrors); setCases(nextCases);
  }
  useEffect(() => { void refresh().catch(e => setMessage(e instanceof Error ? e.message : "Falha ao carregar a biblioteca.")); }, []);

  const normalizedErrorSearch = errorSearch.trim().toLocaleLowerCase("pt-BR");
  const filteredErrors = errors.filter(entry => {
    const text = [entry.question_reference, entry.question_text, entry.user_answer, entry.correct_answer, entry.explanation, entry.subjects?.name, entry.topics?.name, ...entry.tags].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");
    return (!normalizedErrorSearch || text.includes(normalizedErrorSearch)) && (errorStatusFilter === "all" || entry.status === errorStatusFilter);
  });
  const normalizedCaseSearch = caseSearch.trim().toLocaleLowerCase("pt-BR");
  const filteredCases = cases.filter(entry => [entry.title, entry.court, entry.case_reference, entry.summary, ...entry.tags].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR").includes(normalizedCaseSearch));

  async function saveError(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const input = { subject_id: subjectId || null, topic_id: topicId || null, question_reference: reference, question_text: question, user_answer: myAnswer, correct_answer: rightAnswer, explanation, tags: tags.split(",").map(x => x.trim()).filter(Boolean) };
      if (editingErrorId) await updateErrorEntry(editingErrorId, input);
      else await createErrorEntry(input);
      setReference(""); setQuestion(""); setMyAnswer(""); setRightAnswer(""); setExplanation(""); setTags("");
      setEditingErrorId(null); setErrorForm(false); await refresh(); setMessage(editingErrorId ? "Registro atualizado." : "Erro registrado.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Falha ao salvar o erro."); }
    finally { setBusy(false); }
  }
  function editError(entry: ErrorNotebookEntry) {
    setEditingErrorId(entry.id); setSubjectId(entry.subject_id ?? ""); setTopicId(entry.topic_id ?? ""); setReference(entry.question_reference ?? ""); setQuestion(entry.question_text); setMyAnswer(entry.user_answer ?? ""); setRightAnswer(entry.correct_answer ?? ""); setExplanation(entry.explanation); setTags(entry.tags.join(", ")); setErrorForm(true); setMessage("");
  }
  async function changeStatus(id: string, status: ErrorStatus) {
    try { await updateErrorStatus(id, status); await refresh(); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Falha ao atualizar o status."); }
  }
  async function removeError(id: string) {
    if (!window.confirm("Excluir este registro do caderno de erros?")) return;
    try { await deleteErrorEntry(id); await refresh(); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Falha ao excluir o registro."); }
  }
  async function saveCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const input = { title, court, case_reference: caseRef, judgment_date: judgmentDate, summary, source_url: sourceUrl };
      if (editingCaseId) await updateJurisprudenceEntry(editingCaseId, input);
      else await createJurisprudenceEntry(input);
      setTitle(""); setCourt(""); setCaseRef(""); setJudgmentDate(""); setSummary(""); setSourceUrl("");
      setEditingCaseId(null); setCaseForm(false); await refresh(); setMessage(editingCaseId ? "Jurisprudência atualizada." : "Jurisprudência registrada.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Falha ao salvar a jurisprudência."); }
    finally { setBusy(false); }
  }
  function editCase(entry: JurisprudenceEntry) {
    setEditingCaseId(entry.id); setTitle(entry.title); setCourt(entry.court ?? ""); setCaseRef(entry.case_reference ?? ""); setJudgmentDate(entry.judgment_date ?? ""); setSummary(entry.summary); setSourceUrl(entry.source_url ?? ""); setCaseForm(true); setMessage("");
  }
  async function removeCase(id: string) {
    if (!window.confirm("Excluir este registro de jurisprudência?")) return;
    try { await deleteJurisprudenceEntry(id); await refresh(); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Falha ao excluir o registro."); }
  }

  return <>
    {message && <p className="feedback success" role="status">{message}</p>}
    <section className="detail-section">
      <div className="section-heading"><div><span className="eyebrow">APRENDA COM CADA QUESTÃO</span><h2>Caderno de erros</h2><p>Registre a questão, entenda o erro e acompanhe sua revisão.</p></div><button className="add-button" onClick={() => setErrorForm(v => !v)}><Plus size={17}/>{errorForm ? "Fechar" : "Novo registro"}</button></div>
      {errorForm && <form className="entry-form notebook-form" onSubmit={saveError}>
        <h3>{editingErrorId ? "Editar registro" : "Registrar erro"}</h3>
        <label htmlFor="err-subject">Disciplina (opcional)</label><select id="err-subject" value={subjectId} onChange={e => { setSubjectId(e.target.value); setTopicId(""); }}><option value="">Não vinculada</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <label htmlFor="err-topic">Assunto (opcional)</label><select id="err-topic" value={topicId} onChange={e => setTopicId(e.target.value)}><option value="">Não vinculado</option>{topics.filter(t => t.subject_id === subjectId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        <label htmlFor="err-ref">Referência da questão</label><input id="err-ref" value={reference} onChange={e => setReference(e.target.value)} maxLength={300} placeholder="Ex.: Tec Concursos, questão 12345"/>
        <label htmlFor="err-question">Enunciado ou descrição do erro</label><textarea id="err-question" value={question} onChange={e => setQuestion(e.target.value)} maxLength={6000} rows={3} required/>
        <label htmlFor="err-my-answer">Minha resposta</label><textarea id="err-my-answer" value={myAnswer} onChange={e => setMyAnswer(e.target.value)} rows={2} maxLength={2000}/>
        <label htmlFor="err-right-answer">Resposta correta</label><textarea id="err-right-answer" value={rightAnswer} onChange={e => setRightAnswer(e.target.value)} rows={2} maxLength={2000}/>
        <label htmlFor="err-explanation">Explicação / aprendizado</label><textarea id="err-explanation" value={explanation} onChange={e => setExplanation(e.target.value)} rows={3} maxLength={5000}/>
        <label htmlFor="err-tags">Etiquetas (separadas por vírgula)</label><input id="err-tags" value={tags} onChange={e => setTags(e.target.value)} maxLength={300}/>
        <button className="submit-button" disabled={busy || !question.trim()}>{busy ? "Salvando..." : "{editingErrorId ? "Salvar alterações" : "Salvar no caderno"}"}</button>
      </form>}
      {errors.length > 0 && <div className="library-filters"><input aria-label="Pesquisar caderno de erros" value={errorSearch} onChange={e => setErrorSearch(e.target.value)} placeholder="Pesquisar questão, disciplina, assunto ou etiqueta..."/><select aria-label="Filtrar erros por status" value={errorStatusFilter} onChange={e => setErrorStatusFilter(e.target.value)}><option value="all">Todos os status</option><option value="open">Abertos</option><option value="reviewing">Revisando</option><option value="resolved">Resolvidos</option></select></div>}
      {errors.length === 0 ? <div className="empty-state"><span className="empty-icon"><FileWarning size={23}/></span><h3>Nenhum erro registrado.</h3><p>Use este espaço para transformar dificuldades em pontos de revisão.</p></div> : filteredErrors.length === 0 ? <div className="empty-state"><h3>Nenhum resultado encontrado.</h3><p>Altere os termos ou o status do filtro.</p></div> : <div className="notebook-list">{filteredErrors.map(entry => <article className="notebook-row" key={entry.id}><div className="notebook-main">{entry.subjects?.name && <span className="revision-date">{entry.subjects.name}{entry.topics?.name ? " · " + entry.topics.name : ""}</span>}<strong>{entry.question_reference || "Questão sem referência"}</strong><p>{entry.question_text}</p>{entry.user_answer && <small><b>Sua resposta:</b> {entry.user_answer}</small>}{entry.correct_answer && <small><b>Gabarito:</b> {entry.correct_answer}</small>}{entry.explanation && <small><b>Aprendizado:</b> {entry.explanation}</small>}{entry.tags.length > 0 && <small>Etiquetas: {entry.tags.join(", ")}</small>}</div><div className="notebook-controls"><select aria-label="Status do erro" value={entry.status} onChange={e => void changeStatus(entry.id, e.target.value as ErrorStatus)}><option value="open">Aberto</option><option value="reviewing">Revisando</option><option value="resolved">Resolvido</option></select><div className="notebook-actions"><button type="button" className="edit-entry-button" onClick={() => editError(entry)}>Editar</button><button type="button" className="remove-plan-item" aria-label="Excluir registro" onClick={() => void removeError(entry.id)}><Trash2 size={15}/></button></div></div></article>)}</div>}
    </section>
    <section className="detail-section">
      <div className="section-heading"><div><span className="eyebrow">CONSULTA E MEMÓRIA JURÍDICA</span><h2>Jurisprudência</h2><p>Guarde decisões, referências e resumos para revisar.</p></div><button className="add-button" onClick={() => setCaseForm(v => !v)}><Plus size={17}/>{caseForm ? "Fechar" : "Novo registro"}</button></div>
      {caseForm && <form className="entry-form jurisprudence-form" onSubmit={saveCase}>
        <h3>{editingCaseId ? "Editar jurisprudência" : "Adicionar jurisprudência"}</h3>
        <label htmlFor="case-title">Título / tema</label><input id="case-title" value={title} onChange={e => setTitle(e.target.value)} maxLength={220} required/>
        <label htmlFor="case-court">Tribunal</label><input id="case-court" value={court} onChange={e => setCourt(e.target.value)} maxLength={100} placeholder="Ex.: STF, STJ, TJDFT"/>
        <label htmlFor="case-ref">Processo / referência</label><input id="case-ref" value={caseRef} onChange={e => setCaseRef(e.target.value)} maxLength={180}/>
        <label htmlFor="case-date">Data do julgamento</label><input id="case-date" type="date" value={judgmentDate} onChange={e => setJudgmentDate(e.target.value)}/>
        <label htmlFor="case-summary">Resumo</label><textarea id="case-summary" value={summary} onChange={e => setSummary(e.target.value)} rows={3} maxLength={6000}/>
        <label htmlFor="case-url">Link da fonte</label><input id="case-url" type="url" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} maxLength={1000} placeholder="https://..."/>
        <button className="submit-button" disabled={busy || !title.trim()}>{busy ? "Salvando..." : "{editingCaseId ? "Salvar alterações" : "Salvar registro"}"}</button>
      </form>}
      {cases.length > 0 && <div className="library-filters"><input aria-label="Pesquisar jurisprudência" value={caseSearch} onChange={e => setCaseSearch(e.target.value)} placeholder="Pesquisar tema, tribunal, processo ou resumo..."/></div>}
      {cases.length === 0 ? <div className="empty-state"><span className="empty-icon"><Scale size={23}/></span><h3>Sua biblioteca jurídica começa aqui.</h3><p>Salve referências e resumos de decisões importantes.</p></div> : filteredCases.length === 0 ? <div className="empty-state"><h3>Nenhum resultado encontrado.</h3><p>Tente outro termo de pesquisa.</p></div> : <div className="notebook-list">{filteredCases.map(entry => <article className="notebook-row" key={entry.id}><div className="notebook-main"><span className="revision-date">{[entry.court, entry.case_reference, entry.judgment_date ? new Date(entry.judgment_date + "T12:00:00").toLocaleDateString("pt-BR") : ""].filter(Boolean).join(" · ")}</span><strong>{entry.title}</strong>{entry.summary && <p>{entry.summary}</p>}{entry.source_url && <a href={entry.source_url} target="_blank" rel="noreferrer">Abrir fonte</a>}</div><div className="notebook-actions"><button type="button" className="edit-entry-button" onClick={() => editCase(entry)}>Editar</button><button type="button" className="remove-plan-item" aria-label="Excluir registro" onClick={() => void removeCase(entry.id)}><Trash2 size={15}/></button></div></article>)}</div>}
    </section>
  </>;
}
