import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ApiError, request, safeSource } from './api';
import type { Briefing, Catalog, CaseResponse, Health, ImpactEntry } from './types';
import './styles.css';

function Mark({ small = false }: { small?: boolean }) {
  return <svg className={small ? 'mark small' : 'mark'} viewBox="0 0 36 36" fill="none" aria-hidden="true"><path d="M10 9 27 18 10 28V9ZM10 9l0 19M10 9l0 19" stroke="currentColor" strokeWidth="2"/><circle cx="10" cy="9" r="4" fill="currentColor"/><circle cx="27" cy="18" r="4" fill="currentColor"/><circle cx="10" cy="28" r="4" fill="currentColor"/></svg>;
}
function Citations({ ids }: { ids: string[] }) {
  return <span className="citations">{ids.map(id => <a key={id} href={`#evidence-${id}`} onClick={() => document.getElementById(`evidence-${id}`)?.focus()} aria-label={`Inspect evidence ${id}`}>{id} ↗</a>)}</span>;
}
function ErrorNotice({ error, retry }: { error: ApiError; retry?: () => void }) {
  return <div className="notice error" role="alert"><strong>{error.code === 'INSUFFICIENT_EVIDENCE' ? 'Evidence unavailable' : 'Request unsuccessful'}</strong><p>{error.message}</p><small>{error.code}</small>{error.retryable && retry && <button className="secondary" onClick={retry}>Retry request</button>}</div>;
}
function ImpactList({ title, entries, empty }: { title: string; entries: ImpactEntry[]; empty: string }) {
  return <section className="impact-group"><div className="row"><h3>{title}</h3><span className="count">{entries.length}</span></div>{entries.length ? <ul className="file-list">{entries.map(entry => <li key={entry.path}><code>{entry.path}</code><Citations ids={entry.evidenceIds}/></li>)}</ul> : <p className="muted empty-line">{empty}</p>}</section>;
}
function timestamp(value: string) { return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }

function App() {
  const [catalog, setCatalog] = useState<Catalog>();
  const [health, setHealth] = useState<Health>();
  const [healthFailed, setHealthFailed] = useState(false);
  const [catalogError, setCatalogError] = useState<ApiError>();
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState('');
  const [detail, setDetail] = useState<CaseResponse>();
  const [caseError, setCaseError] = useState<ApiError>();
  const [caseReload, setCaseReload] = useState(0);
  const [intent, setIntent] = useState('');
  const [briefing, setBriefing] = useState<Briefing>();
  const [briefError, setBriefError] = useState<ApiError>();
  const [busy, setBusy] = useState(false);
  const [mockControl, setMockControl] = useState('');
  const generation = useRef<AbortController | null>(null);
  const activeCase = useRef('');

  useEffect(() => {
    const controller = new AbortController();
    setCatalogError(undefined);
    request<Catalog>('catalog', controller.signal).then(data => {
      setCatalog(data); setSelected(previous => data.cases.some(item => item.id === previous) ? previous : data.cases[0]?.id ?? '');
    }).catch(error => { if (!controller.signal.aborted) setCatalogError(error); });
    request<Health>('health', controller.signal).then(data => { setHealth(data); setHealthFailed(false); }).catch(() => { if (!controller.signal.aborted) setHealthFailed(true); });
    return () => controller.abort();
  }, [reload]);

  useEffect(() => {
    const controller = new AbortController();
    activeCase.current = selected;
    generation.current?.abort();
    setDetail(undefined); setCaseError(undefined); setBriefing(undefined); setBriefError(undefined); setBusy(false);
    if (selected) request<CaseResponse>(`cases/${encodeURIComponent(selected)}`, controller.signal)
      .then(data => { if (controller.signal.aborted || activeCase.current !== selected) return; if (data.case.id !== selected) throw new ApiError('INVALID_RESPONSE', false, 200); setDetail(data); })
      .catch(error => { if (!controller.signal.aborted) setCaseError(error); });
    return () => { controller.abort(); generation.current?.abort(); };
  }, [selected, caseReload]);

  function chooseCase(id: string) {
    if (id === selected) return;
    generation.current?.abort(); activeCase.current = id;
    setSelected(id); setIntent(''); setBriefing(undefined); setBriefError(undefined); setDetail(undefined); setBusy(false);
  }

  async function generate() {
    if (!detail || busy) return;
    const controller = new AbortController();
    generation.current?.abort(); generation.current = controller;
    setBusy(true); setBriefing(undefined); setBriefError(undefined);
    // Verification controls exist only in development and only after mock health is confirmed.
    const query = import.meta.env.DEV && health?.apiMode === 'mock' && mockControl ? `?${mockControl}` : '';
    try {
      const result = await request<Briefing>(`briefings${query}`, controller.signal, { caseId: selected, ...(intent.trim() ? { changeIntent: intent } : {}) });
      if (controller.signal.aborted || activeCase.current !== selected) return;
      const ids = new Set(detail.case.evidence.map(record => record.id));
      if (result.caseId !== selected || result.commitSha !== detail.repository.commitSha || result.repositoryId !== detail.repository.id
          || result.artifactKind !== detail.artifactKind || !['fixture', 'live'].includes(result.mode)
          || (result.mode === 'live' ? !result.model : result.model !== null)
          || typeof result.markdown !== 'string' || !result.markdown
          || !Array.isArray(result.findings) || !Array.isArray(result.reviewChecklist) || !Array.isArray(result.limitations)
          || [...result.findings, ...result.reviewChecklist].some(item => !Array.isArray(item.evidenceIds) || item.evidenceIds.some(id => !ids.has(id)))) {
        throw new ApiError('INVALID_RESPONSE', false, 200);
      }
      setBriefing(result);
    } catch (error) {
      if (!controller.signal.aborted && activeCase.current === selected) setBriefError(error instanceof ApiError ? error : new ApiError('INVALID_RESPONSE', false, 200));
    } finally { if (!controller.signal.aborted && activeCase.current === selected) setBusy(false); }
  }

  function download() {
    if (!briefing) return;
    const url = URL.createObjectURL(new Blob([briefing.markdown], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `review-${briefing.caseId}.md`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const current = detail?.case;
  // The contract has no completeness field. Preserve warnings verbatim; call out unresolved original labels.
  const unresolved = current?.evidence.some(record => ['unresolved', 'AMBIGUOUS'].includes(record.confidence));
  const metadata = detail ?? catalog;
  return <>
    <a href="#workspace" className="skip-link">Skip to review workspace</a>
    <header className="topbar"><a className="brand" href="/"><Mark/><span>RepoGraph <span className="brand-light">/ Review Desk</span></span></a><span className="top-note">Evidence before assumptions</span><a href="/api/v1/health" className="health-link"><span className={`dot ${health ? 'connected' : ''}`}/>{health ? `${health.apiMode === 'mock' ? 'Mock API' : 'Service API'} connected` : healthFailed ? 'Health unavailable' : 'Checking API…'} ↗</a></header>
    <div className="app-shell">
      <aside className="sidebar" aria-label="Prepared scenarios">
        <div className="eyebrow">REVIEW WORKSPACE</div><h2>Prepared scenarios</h2><p className="sidebar-intro">Choose a file. Follow the evidence.</p>
        {!catalog && !catalogError && <p role="status">Loading scenarios…</p>}
        {catalogError && <ErrorNotice error={catalogError} retry={() => setReload(value => value + 1)}/>}
        {catalog && !catalog.cases.length && <p role="status">No prepared scenarios are available in this snapshot.</p>}
        <nav className="scenario-list" aria-label="Select a scenario">{catalog?.cases.map((scenario, index) => <button key={scenario.id} aria-current={selected === scenario.id ? 'true' : undefined} className={`scenario ${selected === scenario.id ? 'selected' : ''}`} onClick={() => chooseCase(scenario.id)}><span className="scenario-number">0{index + 1}</span><span><strong>{scenario.title}</strong><code>{scenario.changedFiles[0]}</code></span><span aria-hidden="true">↗</span></button>)}</nav>
        <div className="sidebar-bottom"><Mark small/><strong>A snapshot, with context.</strong><p>Prepared file-impact scenarios. Different patches to the same file are not analyzed independently.</p><span className="sidebar-tag">CONTRACT v1.0.0</span></div>
      </aside>
      <main id="workspace" tabIndex={-1}>
        <div className="page-heading"><div><div className="eyebrow">THE REVIEW DESK</div><h1>Understand the ripple effect.</h1><p>Trace what a file touches, inspect the sources, and prepare your review.</p></div><span className="snapshot-tag">◈ Prepared snapshot</span></div>
        {metadata && <section className="repository" aria-label="Repository provenance"><div><span className="meta-label">REPOSITORY</span><strong>{metadata.repository.name}</strong><code className="commit">Commit · {metadata.repository.commitSha}</code></div><div className="repo-details"><span className={`badge ${metadata.artifactKind === 'fixture' ? 'amber' : 'green'}`}>Analysis · {metadata.artifactKind === 'fixture' ? 'Synthetic fixture' : 'Generated snapshot'}</span><small>Snapshot generated {timestamp(metadata.generatedAt)}</small><span className="tool-list">{metadata.tools.map(tool => <span key={tool.name}>{tool.name} · {tool.version} · {tool.mode}</span>)}</span></div></section>}
        {metadata?.artifactKind === 'fixture' && <div className="fixture-banner"><span aria-hidden="true">ⓘ</span><span><strong>Development fixture.</strong> Synthetic relationships and source excerpts. This is not analysis of a real repository.</span></div>}
        {caseError && <ErrorNotice error={caseError} retry={() => setCaseReload(value => value + 1)}/>}
        {selected && !detail && !caseError && <div className="loading-panel" role="status"><span className="spinner"/>Loading scenario evidence…</div>}
        {current && <>
          <section className="case-heading"><div className="eyebrow">SELECTED SCENARIO / FILE IMPACT</div><h2>{current.title}</h2><div className="changed-files">{current.changedFiles.map(path => <code key={path}><span aria-hidden="true">↳ </span>{path}</code>)}</div><p className="case-status" role="status">{!current.evidence.length ? 'Empty result — no usable evidence' : unresolved ? 'Partial / unresolved evidence — inspect the warnings below' : 'Evidence ready — inspect limitations before relying on this snapshot'}</p></section>
          <div className="review-grid"><div className="evidence-column">
            <section className="panel impact-panel"><div className="panel-heading"><span className="section-number">01</span><h2>Impact at a glance</h2><span className="panel-note">RepoGraph</span></div><ImpactList title="Direct dependents" entries={current.impact.directDependents} empty="No direct dependents recorded. Absence does not establish safety."/><ImpactList title="Transitive dependents" entries={current.impact.transitiveDependents} empty="No transitive dependents recorded in this snapshot."/><ImpactList title="Candidate tests" entries={current.impact.relatedTests} empty="No candidate tests recorded. Run the full test suite."/><p className="panel-footnote">Candidate tests are suggestions; they do not prove complete coverage.</p></section>
            <section className="panel architecture-panel"><div className="panel-heading"><span className="section-number">02</span><h2>Architecture context</h2><span className="panel-note">Graphify</span></div><p>{current.architecture.summary || 'No architecture context was recorded for this scenario.'}</p>{current.architecture.contextText && <blockquote>{current.architecture.contextText}</blockquote>}<Citations ids={current.architecture.evidenceIds}/></section>
            <section className="panel warnings"><div className="panel-heading"><span className="warning-symbol" aria-hidden="true">△</span><h2>Limitations & blind spots</h2></div><ul>{[...new Set([...current.limitations, ...current.impact.blindSpots])].map(text => <li key={text}>{text}</li>)}</ul></section>
          </div><div className="briefing-column"><section className="panel briefing-panel" aria-labelledby="briefing-title"><div className="panel-heading"><span className="section-number">03</span><h2 id="briefing-title">Your review briefing</h2></div><p className="briefing-intro">Turn the supplied evidence into a focused review checklist.</p><div className="inference-label">{health ? health.aiMode === 'fixture' ? 'Inference · Fixture / canned response; no model called' : 'Inference configured · Live (verified on response)' : 'Inference configuration unavailable'}</div>
            <form onSubmit={event => { event.preventDefault(); void generate(); }}><label htmlFor="change-intent">What are you intending to change? <span>(optional)</span></label><textarea id="change-intent" maxLength={500} value={intent} onChange={event => setIntent(event.target.value)} placeholder="e.g. Adjust how cancellation requests are handled…" aria-describedby="intent-help intent-count" disabled={busy}/><div className="intent-meta"><span id="intent-count">{intent.length}/500</span></div><p id="intent-help" className="help">Intention within this prepared scenario. No patch or arbitrary PR is inspected.</p>
            {import.meta.env.DEV && health?.apiMode === 'mock' && <details className="dev-controls"><summary>Local mock verification</summary><label htmlFor="mock-control">Simulate briefing behavior</label><select id="mock-control" value={mockControl} onChange={event => setMockControl(event.target.value)}><option value="">Normal response</option><option value="delayMs=1200">Loading (1.2 seconds)</option><option value="mock=timeout">Timeout (504)</option><option value="mock=rate-limit">Rate limit (429)</option><option value="mock=invalid-response">Invalid response (502)</option></select></details>}
            <button className="primary generate" disabled={busy} type="submit">{busy ? <><span className="spinner"/>Preparing briefing…</> : <>Generate briefing <span aria-hidden="true">↗</span></>}</button></form>
            <div aria-live="polite">{busy && <p className="loading-message" role="status">Waiting for the service. You can switch scenarios to cancel.</p>}</div>
            {briefError && <ErrorNotice error={briefError} retry={() => void generate()}/>}
            {!briefing && !busy && !briefError && <div className="briefing-placeholder"><Mark/><strong>Your evidence-backed briefing starts here.</strong><p>Findings, citations, and a checklist will appear after generation.</p></div>}
            {briefing && <article className="briefing-result" aria-label="Generated briefing"><div className="result-heading"><span className={`badge ${briefing.mode === 'fixture' ? 'amber' : 'green'}`}>{briefing.mode === 'fixture' ? 'Fixture inference · No model called' : 'Live inference'}</span><button className="download" onClick={download}>↓ Download Markdown</button></div><dl className="briefing-provenance"><dt>Analysis</dt><dd>{briefing.artifactKind}</dd><dt>Model</dt><dd>{briefing.model ?? 'None — canned response'}</dd><dt>Commit</dt><dd><code>{briefing.commitSha}</code></dd><dt>Generated</dt><dd>{timestamp(briefing.generatedAt)}</dd></dl><h3>Summary</h3><p>{briefing.summary}</p><h3>Findings</h3><ul className="finding-list">{briefing.findings.map((finding, i) => <li key={i}>{finding.text}<Citations ids={finding.evidenceIds}/></li>)}</ul><h3>Review checklist</h3><ul className="checklist">{briefing.reviewChecklist.map((item, i) => <li key={i}><label><input type="checkbox"/>{item.text}</label><Citations ids={item.evidenceIds}/></li>)}</ul><h3>Briefing limitations</h3><ul>{briefing.limitations.map((text, i) => <li key={i}>{text}</li>)}</ul></article>}
          </section></div></div>
          <section className="panel source-panel" aria-labelledby="source-title"><div className="panel-heading"><span className="section-number">04</span><h2 id="source-title">Source evidence</h2><span className="panel-note">{current.evidence.length} records</span></div><p className="muted">Original producer labels are preserved. Confidence labels are not comparable risk scores.</p>{!current.evidence.length && <p className="empty-evidence">No evidence records available. Inspect the limitations and run the full test suite.</p>}<div className="evidence-records">{current.evidence.map(record => { const href = safeSource(record.sourceUrl); return <article key={record.id} id={`evidence-${record.id}`} tabIndex={-1} className="evidence-record"><div className="row evidence-heading"><strong>{record.id}</strong><span className="producer">{record.producer}</span><span className="confidence">{record.confidence}</span></div><div className="evidence-location"><code>{record.path}:{record.startLine}{record.endLine !== record.startLine ? `–${record.endLine}` : ''}</code><span>{record.relation}</span></div><pre><code>{record.excerpt}</code></pre>{href ? <a href={href} target="_blank" rel="noopener noreferrer" className="source-link">View source at pinned commit ↗</a> : <p className="source-unavailable">{record.sourceUrl === null ? 'Synthetic fixture — source link unavailable.' : 'Source link unavailable — unsupported URL.'}</p>}</article>; })}</div></section>
        </>}
        <footer><span>RepoGraph Review Desk</span><p>Review guidance from bounded evidence. Run the full test suite.</p><a href="#workspace">Back to top ↑</a></footer>
      </main>
    </div>
  </>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);
