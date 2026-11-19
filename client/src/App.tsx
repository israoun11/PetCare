import { createContext, FormEvent, ReactNode, useContext, useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { Home, PawPrint, HeartPulse, CalendarCheck, HeartHandshake, Users, ShoppingBag, LogOut, Shield, Send, X } from 'lucide-react';
import { api, errMsg, Item } from './api'; import Mascot from './Mascot'; import { Adoption, Admin, Community, Dashboard, Profile, Store, Care, Health, Pets } from './pages';
type U = { id: string; name: string; email: string; role: string };
const Ctx = createContext<{ user: U | null; setUser: (u: U | null) => void }>({ user: null, setUser: () => {} });
export const useAuth = () => useContext(Ctx);
const NAV = [['/', 'Dashboard', Home], ['/pets', 'My Pets', PawPrint], ['/health', 'Health', HeartPulse], ['/care', 'Daily Care', CalendarCheck], ['/adoption', 'Adoption', HeartHandshake], ['/community', 'Community', Users], ['/store', 'Pet Store', ShoppingBag]] as const;

function Assistant() {
  const [open, setOpen] = useState(false); const [msgs, setMsgs] = useState<Item[]>([]); const [text, setText] = useState(''); const [cid, setCid] = useState<string>(); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [pet, setPet] = useState(''); const [pets, setPets] = useState<Item[]>([]);
  useEffect(() => { if (open) api.get('/pets').then(r => setPets(r.data.data)).catch(() => {}); }, [open]);
  const send = async (e: FormEvent) => { e.preventDefault(); if (!text.trim()) return; const m = text; setText(''); setErr(''); setMsgs(x => [...x, { role: 'user', content: m }]); setBusy(true);
    try { const r = await api.post('/ai/chat', { message: m, conversationId: cid, petId: pet || undefined }); setCid(r.data.data.conversationId); setMsgs(x => [...x, { role: 'assistant', content: r.data.data.reply }]); } catch (x) { setErr(errMsg(x)); } finally { setBusy(false); } };
  return (<>
    <button onClick={() => setOpen(true)} className="fixed bottom-20 right-4 z-40 rounded-full bg-lav p-1 shadow-lg md:bottom-6" aria-label="Open PetCare Assistant"><Mascot size={52} /></button>
    {open && <div className="fixed inset-x-2 bottom-2 top-16 z-50 flex flex-col rounded-3xl bg-white shadow-2xl md:inset-x-auto md:right-6 md:w-96" role="dialog">
      <div className="flex items-center gap-2 rounded-t-3xl bg-lav p-3"><Mascot size={40} /><div className="flex-1"><b>PetCare Assistant</b><div className="text-xs">General pet-care info — not veterinary advice.</div></div><button onClick={() => setOpen(false)} aria-label="Close"><X /></button></div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3 text-sm">
        {!msgs.length && <div className="py-6 text-center"><Mascot size={80} /><p className="mt-2">Hi! Ask me anything about caring for your pets.</p></div>}
        {msgs.map((m, i) => <div key={i} className={m.role === 'user' ? 'ml-8 rounded-2xl bg-beige p-2' : 'mr-8 whitespace-pre-wrap rounded-2xl bg-cream p-2'}>{m.content}</div>)}
        {busy && <div className="text-ink/60">Thinking…</div>}{err && <p className="text-red-700" role="alert">{err}</p>}</div>
      <form onSubmit={send} className="space-y-2 border-t border-beige p-3">
        <select className="input" value={pet} onChange={e => setPet(e.target.value)}><option value="">Don't share a pet profile</option>{pets.map(p => <option key={p._id} value={p._id}>Share {p.name}'s profile</option>)}</select>
        <div className="flex gap-2"><input className="input" value={text} maxLength={2000} onChange={e => setText(e.target.value)} placeholder="Ask a question…" /><button className="btn" disabled={busy} aria-label="Send"><Send size={16} /></button></div></form></div>}
  </>);
}
function Shell({ children }: { children: ReactNode }) {
  const { user, setUser } = useAuth(); const nav = useNavigate();
  const items = user?.role === 'admin' ? [...NAV, ['/admin', 'Admin', Shield] as const] : NAV;
  return (<div className="min-h-screen md:flex">
    <aside className="hidden w-60 shrink-0 flex-col gap-1 bg-forest p-4 text-cream md:flex">
      <Link to="/" className="mb-4 flex items-center gap-2 text-xl font-bold"><Mascot size={40} />PETCARE</Link>
      {items.map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `flex items-center gap-2 rounded-2xl px-3 py-2 ${isActive ? 'bg-lav text-ink' : 'hover:bg-white/10'}`}><Icon size={18} />{label}</NavLink>)}
      <div className="mt-auto text-sm"><Link to="/profile" className="block rounded-2xl px-3 py-2 hover:bg-white/10">{user?.name}</Link>
        <button className="flex items-center gap-2 px-3 py-2" onClick={() => { localStorage.removeItem('token'); setUser(null); nav('/login'); }}><LogOut size={16} />Log out</button></div></aside>
    <main className="min-w-0 flex-1 p-4 pb-28 md:p-8">{children}</main>
    <nav className="fixed inset-x-0 bottom-0 z-30 flex overflow-x-auto bg-forest p-1 text-cream md:hidden">{[...items, ['/profile', 'Profile', Users] as const].map(([to, label, Icon]) =>
      <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `flex min-w-[72px] flex-col items-center rounded-2xl p-2 text-[11px] ${isActive ? 'bg-lav text-ink' : ''}`}><Icon size={18} />{label}</NavLink>)}</nav>
    <Assistant /></div>);
}
function AuthPage({ mode }: { mode: 'login' | 'register' | 'forgot' | 'reset' }) {
  const { setUser } = useAuth(); const nav = useNavigate(); const { token } = useParams(); const [f, setF] = useState({ name: '', email: '', password: '', confirm: '' }); const [show, setShow] = useState(false); const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => { e.preventDefault(); setErr(''); setOk('');
    if ((mode === 'register' || mode === 'reset') && f.password !== f.confirm) return setErr('Passwords do not match.');
    setBusy(true);
    try {
      if (mode === 'forgot') { const r = await api.post('/auth/forgot', { email: f.email }); setOk(r.data.data.message); }
      else if (mode === 'reset') { await api.post('/auth/reset', { token, password: f.password }); nav('/login'); }
      else { const r = await api.post('/auth/' + mode, mode === 'login' ? { email: f.email, password: f.password } : { name: f.name, email: f.email, password: f.password }); localStorage.setItem('token', r.data.data.token); setUser(r.data.data.user); nav('/'); }
    } catch (x) { setErr(errMsg(x)); } finally { setBusy(false); } };
  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (<div className="flex min-h-screen items-center justify-center bg-sage/30 p-4"><form onSubmit={submit} className="card w-full max-w-sm space-y-3">
    <div className="text-center"><Mascot size={72} /><h1 className="text-2xl font-bold">PETCARE</h1><p className="text-sm">Everything Your Pet Needs, All in One Place.</p></div>
    {mode === 'register' && <input className="input" placeholder="Full name" required value={f.name} onChange={set('name')} />}
    {mode !== 'reset' && <input className="input" type="email" placeholder="Email" required value={f.email} onChange={set('email')} />}
    {mode !== 'forgot' && <input className="input" type={show ? 'text' : 'password'} placeholder="Password (8+ characters)" required minLength={8} value={f.password} onChange={set('password')} />}
    {(mode === 'register' || mode === 'reset') && <input className="input" type={show ? 'text' : 'password'} placeholder="Confirm password" required value={f.confirm} onChange={set('confirm')} />}
    {mode !== 'forgot' && <label className="text-sm"><input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)} /> Show password</label>}
    {err && <p className="text-sm text-red-700" role="alert">{err}</p>}{ok && <p className="text-sm text-forest">{ok}</p>}
    <button className="btn w-full" disabled={busy}>{busy ? 'Please wait…' : { login: 'Log in', register: 'Create account', forgot: 'Send reset link', reset: 'Set new password' }[mode]}</button>
    <div className="flex justify-between text-sm">{mode === 'login' ? <><Link to="/register">Create account</Link><Link to="/forgot">Forgot password?</Link></> : <Link to="/login">Back to log in</Link>}</div></form></div>);
}
function PetProfile() {
  const { id } = useParams(); const [pet, setPet] = useState<Item | null>(null); const [rec, setRec] = useState<Item[]>([]); const [tasks, setTasks] = useState<Item[]>([]); const [err, setErr] = useState('');
  useEffect(() => { Promise.all([api.get('/pets/' + id), api.get('/health?pet=' + id), api.get('/care?pet=' + id)]).then(([a, b, c]) => { setPet(a.data.data); setRec(b.data.data); setTasks(c.data.data); }).catch(e => setErr(errMsg(e))); }, [id]);
  if (err) return <p className="card text-red-700">{err}</p>; if (!pet) return <div className="card h-40 animate-pulse" />;
  const w = rec.filter(r => r.kind === 'weight' && r.value).sort((a, b) => +new Date(a.date) - +new Date(b.date)); const max = Math.max(...w.map(x => x.value), 1);
  const pts = w.map((x, i) => `${(i / Math.max(w.length - 1, 1)) * 280 + 10},${90 - (x.value / max) * 70}`).join(' ');
  return (<div className="space-y-4"><Link to="/pets" className="text-sm underline">← My pets</Link>
    <div className="card md:flex md:gap-6">{pet.photo ? <img src={pet.photo} alt={pet.name} className="h-56 w-full rounded-2xl object-cover md:w-64" /> : <div className="flex h-56 items-center justify-center rounded-2xl bg-beige md:w-64"><Mascot size={96} /></div>}
      <div className="mt-3 space-y-1 md:mt-0"><h1 className="text-3xl font-bold">{pet.name}</h1><p>{pet.species} · {pet.breed || 'Breed unknown'} · {pet.gender}</p><p>Weight: {pet.weight ?? '—'} kg · Born {pet.birthDate?.slice(0, 10) || '—'}</p><p>{pet.description}</p>{pet.notes && <p className="text-sm">Notes: {pet.notes}</p>}</div></div>
    {w.length > 1 && <div className="card"><h3 className="font-bold">Weight history</h3><svg viewBox="0 0 300 100" className="w-full"><polyline points={pts} fill="none" stroke="#405D50" strokeWidth="3" /></svg></div>}
    <div className="grid gap-4 md:grid-cols-2"><div className="card"><h3 className="font-bold">Health</h3>{rec.length ? rec.map(r => <p key={r._id} className="text-sm">{r.kind}: {r.title} {r.date?.slice(0, 10)}</p>) : <p className="text-sm">No records yet.</p>}</div>
      <div className="card"><h3 className="font-bold">Daily care</h3>{tasks.length ? tasks.map(t => <p key={t._id} className="text-sm">{t.done ? '✓' : '○'} {t.title} — {new Date(t.dueAt).toLocaleString()}</p>) : <p className="text-sm">No tasks yet.</p>}</div></div></div>);
}
export default function App() {
  const [user, setUser] = useState<U | null>(null); const [ready, setReady] = useState(false);
  useEffect(() => { if (!localStorage.getItem('token')) return setReady(true); api.get('/auth/me').then(r => setUser(r.data.data)).catch(() => localStorage.removeItem('token')).finally(() => setReady(true)); }, []);
  if (!ready) return <div className="p-8">Loading…</div>;
  const guard = (el: ReactNode, admin = false) => !user ? <Navigate to="/login" /> : admin && user.role !== 'admin' ? <Navigate to="/" /> : <Shell>{el}</Shell>;
  return (<Ctx.Provider value={{ user, setUser }}><Routes>
    <Route path="/login" element={user ? <Navigate to="/" /> : <AuthPage mode="login" />} /><Route path="/register" element={<AuthPage mode="register" />} />
    <Route path="/forgot" element={<AuthPage mode="forgot" />} /><Route path="/reset/:token" element={<AuthPage mode="reset" />} />
    <Route path="/" element={guard(<Dashboard />)} /><Route path="/pets" element={guard(<Pets />)} /><Route path="/pets/:id" element={guard(<PetProfile />)} />
    <Route path="/health" element={guard(<Health />)} /><Route path="/care" element={guard(<Care />)} /><Route path="/adoption" element={guard(<Adoption />)} />
    <Route path="/community" element={guard(<Community />)} /><Route path="/store" element={guard(<Store />)} /><Route path="/profile" element={guard(<Profile />)} />
    <Route path="/admin" element={guard(<Admin />, true)} /><Route path="*" element={<Navigate to="/" />} /></Routes></Ctx.Provider>);
}
