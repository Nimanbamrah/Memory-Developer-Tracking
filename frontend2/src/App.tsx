import { FormEvent, useEffect, useMemo, useState } from 'react';
import { memoryApi, type StoredMemory, type Telemetry } from './api';

type Page = 'home' | 'capture' | 'chat' | 'history';
type ChatMessage = { role: 'user' | 'assistant'; text: string; matches?: number; telemetry?: Telemetry };

const navItems: { id: Page; label: string; icon: string }[] = [
  { id: 'home', label: 'Overview', icon: '◈' },
  { id: 'capture', label: 'Add memory', icon: '+' },
  { id: 'chat', label: 'Ask your memory', icon: '⌁' },
  { id: 'history', label: 'History', icon: '◷' },
];

const initialChat: ChatMessage[] = [{
  role: 'assistant',
  text: 'I’m ready to search your saved development knowledge. Ask about a bug, design decision, or solution you have captured.',
}];

export default function App() {
  const [page, setPage] = useState<Page>('home');
  const [memoryCount, setMemoryCount] = useState<number | null>(null);
  const [statsError, setStatsError] = useState(false);
  const [form, setForm] = useState({ title: '', problem: '', solution: '', tags: '' });
  const [formState, setFormState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [formError, setFormError] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [chat, setChat] = useState<ChatMessage[]>(initialChat);
  const [chatting, setChatting] = useState(false);

  const refreshStats = async () => {
    try {
      const stats = await memoryApi.stats();
      setMemoryCount(stats.totalMemories);
      setStatsError(false);
    } catch {
      setStatsError(true);
    }
  };

  useEffect(() => { void refreshStats(); }, []);

  const recentPipeline = useMemo(
    () => [...chat].reverse().find((item) => item.role === 'assistant' && item.telemetry),
    [chat],
  );

  const submitMemory = async (event: FormEvent) => {
    event.preventDefault();
    setFormState('saving'); setFormError('');
    try {
      await memoryApi.create({
        title: form.title.trim(), problem: form.problem.trim(), solution: form.solution.trim(),
        tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      });
      setForm({ title: '', problem: '', solution: '', tags: '' });
      setFormState('saved');
      await refreshStats();
    } catch (error) {
      setFormState('error');
      setFormError(error instanceof Error ? error.message : 'Unable to save the memory.');
    }
  };

  const submitChat = async (event: FormEvent) => {
    event.preventDefault();
    const question = chatInput.trim();
    if (!question || chatting) return;
    setChatInput(''); setChatting(true);
    setChat((previous) => [...previous, { role: 'user', text: question }]);
    try {
      const response = await memoryApi.chat(question);
      setChat((previous) => [...previous, { role: 'assistant', text: response.reply, matches: response.contextMatchedCount, telemetry: response.telemetry }]);
    } catch (error) {
      setChat((previous) => [...previous, { role: 'assistant', text: error instanceof Error ? error.message : 'Unable to reach your memory service.' }]);
    } finally { setChatting(false); }
  };

  return <div className="app-shell">
    <aside className="sidebar">
      <button className="brand" onClick={() => setPage('home')} aria-label="Go to overview"><span className="brand-mark">DME</span><span className="brand-copy"><b>Developer</b><small>Memory Engine</small></span></button>
      <p className="brand-line">A calmer home for the fixes worth keeping.</p>
      <nav>{navItems.map((item) => <button key={item.id} onClick={() => setPage(item.id)} className={page === item.id ? 'nav-item active' : 'nav-item'}><i>{item.icon}</i>{item.label}</button>)}</nav>
      <div className="sidebar-bottom"><span className="status-dot"/> Backend connection {statsError ? 'needs attention' : 'available'}</div>
    </aside>
    <main className="content">
      <header className="topbar"><div><span className="crumb">Developer Memory Engine / <b>{navItems.find((item) => item.id === page)?.label}</b></span><span className="mobile-title">DME</span></div><div className="header-links"><button onClick={() => setPage('capture')}>Add memory</button><button onClick={() => setPage('chat')}>Ask DME</button><button className="memory-pill" onClick={() => setPage('history')}><span>◈</span> {memoryCount ?? '—'} memories</button></div></header>
      {page === 'home' && <Home count={memoryCount} onNavigate={setPage}/>} 
      {page === 'capture' && <Capture form={form} setForm={setForm} state={formState} error={formError} onSubmit={submitMemory}/>} 
      {page === 'chat' && <Chat messages={chat} input={chatInput} setInput={setChatInput} sending={chatting} onSubmit={submitChat} pipeline={recentPipeline}/>} 
      {page === 'history' && <History count={memoryCount} failed={statsError} refreshStats={refreshStats} onAdd={() => setPage('capture')}/>} 
      <footer className="footer"><span>© {new Date().getFullYear()} Developer Memory Engine</span><span>Capture · Recall · Build</span></footer>
    </main>
  </div>;
}

function Home({ count, onNavigate }: { count: number | null; onNavigate: (page: Page) => void }) {
  return <section className="page home"><div className="eyebrow">YOUR ENGINEERING SECOND BRAIN</div><h1>Keep the solution.<br/><em>Lose the rediscovery.</em></h1><p className="hero-copy">Capture hard-won fixes as durable memories. When the same problem returns, ask your own knowledge base for the answer.</p><div className="hero-actions"><button className="primary" onClick={() => onNavigate('capture')}>Capture a memory <span>→</span></button><button className="secondary" onClick={() => onNavigate('chat')}>Ask your memory</button></div><div className="stat-line"><strong>{count ?? '—'}</strong><span>memories in your workspace</span></div><div className="workflow"><article><b>01</b><h3>Capture the context</h3><p>Record the problem, resolution, and useful tags when the work is fresh.</p></article><article><b>02</b><h3>We index the meaning</h3><p>Your backend creates a semantic memory that is ready to retrieve later.</p></article><article><b>03</b><h3>Ask in plain English</h3><p>Search previous decisions naturally, right when you need them.</p></article></div></section>;
}

function Capture({ form, setForm, state, error, onSubmit }: { form: { title: string; problem: string; solution: string; tags: string }; setForm: (form: { title: string; problem: string; solution: string; tags: string }) => void; state: string; error: string; onSubmit: (event: FormEvent) => void }) {
  const update = (field: keyof typeof form, value: string) => setForm({ ...form, [field]: value });
  return <section className="page narrow"><div className="page-heading"><div><div className="eyebrow">KNOWLEDGE CAPTURE</div><h2>Add a memory</h2><p>Turn a solved problem into something your future self can find.</p></div></div>{state === 'saved' && <div className="notice success">Memory saved and added to your semantic index.</div>}{state === 'error' && <div className="notice error">{error}</div>}<form className="memory-form" onSubmit={onSubmit}><label>Memory title<input required value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="e.g. Fixing CORS credentials in production"/></label><label>What was the problem?<textarea required rows={5} value={form.problem} onChange={(e) => update('problem', e.target.value)} placeholder="Describe symptoms, context, and what made this difficult..."/></label><label>What was the solution?<textarea required rows={7} value={form.solution} onChange={(e) => update('solution', e.target.value)} placeholder="Document the fix, the decision, and why it worked..."/></label><label>Tags <small>optional, comma separated</small><input value={form.tags} onChange={(e) => update('tags', e.target.value)} placeholder="react, api, deployment"/></label><button className="primary submit" disabled={state === 'saving'}>{state === 'saving' ? 'Saving to memory…' : 'Save memory'} <span>→</span></button></form></section>;
}

function Chat({ messages, input, setInput, sending, onSubmit, pipeline }: { messages: ChatMessage[]; input: string; setInput: (value: string) => void; sending: boolean; onSubmit: (event: FormEvent) => void; pipeline?: ChatMessage }) {
  return <section className="page chat-page"><div className="page-heading"><div><div className="eyebrow">SEMANTIC RETRIEVAL</div><h2>Ask your memory</h2><p>Answers are composed only from the knowledge you have saved.</p></div></div><div className="chat-layout"><div className="conversation"><div className="messages">{messages.map((message, index) => <div className={`message ${message.role}`} key={index}><div className="avatar">{message.role === 'user' ? 'Y' : 'M'}</div><div><div className="message-label">{message.role === 'user' ? 'You' : 'MemoryOS'}</div><p>{message.text}</p>{message.matches !== undefined && <span className="match-chip">{message.matches} related {message.matches === 1 ? 'memory' : 'memories'} used</span>}</div></div>)}{sending && <div className="thinking"><span/><span/><span/> Searching your saved context</div>}</div><form className="chat-input" onSubmit={onSubmit}><input value={input} onChange={(e) => setInput(e.target.value)} disabled={sending} placeholder="Ask about a previous problem or decision…"/><button className="primary" disabled={sending || !input.trim()}>Send <span>↑</span></button></form></div><aside className="insights"><div className="insight-title">Pipeline insight <span>NEW</span></div><p>See how the retrieval pipeline performed for your most recent answer.</p>{pipeline?.telemetry ? <div className="telemetry"><Metric label="Embedding" value={pipeline.telemetry.embeddingMs}/><Metric label="Memory search" value={pipeline.telemetry.dbMs}/><Metric label="Response" value={pipeline.telemetry.llmMs}/></div> : <div className="empty-insight">Ask a question to see retrieval timing and matched-memory signals here.</div>}</aside></div></section>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div><span>{label}</span><b>{value.toFixed(0)}<small> ms</small></b></div>; }

function History({ count, failed, refreshStats, onAdd }: { count: number | null; failed: boolean; refreshStats: () => Promise<void>; onAdd: () => void }) {
  const [memories, setMemories] = useState<StoredMemory[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');

  const load = async (targetPage: number, replace = false) => {
    setLoading(true); setHistoryError('');
    try {
      const result = await memoryApi.history(targetPage);
      setMemories((current) => replace ? result.memories : [...current, ...result.memories]);
      setPage(targetPage); setHasMore(result.hasMore);
    } catch (error) { setHistoryError(error instanceof Error ? error.message : 'Unable to load memories.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(1, true); }, []);
  const refresh = async () => { await Promise.all([refreshStats(), load(1, true)]); };

  return <section className="page narrow"><div className="page-heading"><div><div className="eyebrow">WORKSPACE ACTIVITY</div><h2>Memory history</h2><p>Browse every problem-solution pair stored in your knowledge base.</p></div><button className="secondary compact" disabled={loading} onClick={() => void refresh()}>Refresh</button></div><div className="history-card"><div className="history-icon">◈</div><div><span>Total memories generated</span><strong>{failed ? 'Unavailable' : count ?? 'Loading…'}</strong><p>{failed ? 'The backend stats endpoint could not be reached.' : 'Only the fields needed for this list are loaded; vector embeddings are never fetched.'}</p></div></div><div className="memory-list">{historyError && <div className="notice error">{historyError}</div>}{!loading && !historyError && memories.length === 0 && <div className="empty-history"><h3>Your memory bank is empty.</h3><p>Capture your first solution to make it searchable later.</p><button className="primary" onClick={onAdd}>Add a memory <span>→</span></button></div>}{memories.map((memory) => <article className="memory-row" key={memory.id}><div className="memory-row-top"><div><time>{new Date(memory.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</time><h3>{memory.title}</h3></div>{memory.tags.length > 0 && <div className="tags">{memory.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}</div><details><summary>View problem and solution <span>⌄</span></summary><div className="memory-detail"><div><b>Problem</b><p>{memory.problem}</p></div><div><b>Solution</b><p>{memory.solution}</p></div></div></details></article>)}{loading && <div className="history-loading">Loading stored memories…</div>}{hasMore && !loading && <button className="secondary load-more" onClick={() => void load(page + 1)}>Load more memories</button>}</div></section>;
}
