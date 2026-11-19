import { ReactNode, useEffect, useState } from 'react'; import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { api, errMsg, Item, useLoad } from './api'; import Mascot from './Mascot';
export type Field = { name: string; label: string; type?: 'text' | 'number' | 'date' | 'datetime-local' | 'select' | 'textarea' | 'checkbox'; options?: string[]; pet?: boolean; required?: boolean };
export const Photo = ({ src, name }: { src?: string; name?: string }) => {
  const [bad, setBad] = useState(false);
  return src && !bad ? <img src={src} alt={name} loading="lazy" onError={() => setBad(true)} className="h-40 w-full rounded-2xl object-cover" />
    : <div className="flex h-40 w-full items-center justify-center rounded-2xl bg-beige"><Mascot size={64} /></div>;
};
const cut = (t: string | undefined, f: Field) => (t && f.type === 'date' ? t.slice(0, 10) : t && f.type === 'datetime-local' ? new Date(new Date(t).getTime() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : t ?? '');
export default function Resource(p: { title: string; path: string; query?: string; fields: Field[]; summary?: (i: Item) => ReactNode; actions?: (i: Item, reload: () => void) => ReactNode; photo?: boolean; empty?: string; readOnly?: boolean }) {
  const { data, error, load } = useLoad(p.path + '?' + (p.query || '')); const pets = useLoad('/pets');
  const [edit, setEdit] = useState<Item | null>(null); const [form, setForm] = useState<Item>({}); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { if (edit) setForm(Object.fromEntries(p.fields.map(f => [f.name, f.pet ? (edit[f.name]?._id ?? edit[f.name] ?? '') : cut(edit[f.name], f)]))); setMsg(''); }, [edit]); // eslint-disable-line
  const save = async () => {
    setBusy(true); setMsg('');
    try {
      const body: Item = {}; p.fields.forEach(f => { const v = form[f.name]; if (v !== '' && v !== undefined) body[f.name] = f.type === 'number' ? Number(v) : f.type === 'datetime-local' ? new Date(v).toISOString() : v; });
      edit?._id ? await api.put(`${p.path}/${edit._id}`, body) : await api.post(p.path, body); setEdit(null); load();
    } catch (e) { setMsg(errMsg(e)); } finally { setBusy(false); }
  };
  const del = async (i: Item) => { if (!confirm('Delete this item? This cannot be undone.')) return; try { await api.delete(`${p.path}/${i._id}`); load(); } catch (e) { alert(errMsg(e)); } };
  return (<section>
    <div className="mb-4 flex items-center justify-between"><h2 className="text-2xl font-bold">{p.title}</h2>
      {!p.readOnly && <button className="btn" onClick={() => setEdit({})}><Plus size={16} />Add</button>}</div>
    {error && <p className="card text-red-700" role="alert">{error}</p>}
    {data && !data.length && <div className="card flex flex-col items-center gap-2 py-10 text-center"><Mascot size={72} /><p>{p.empty || 'Nothing here yet.'}</p></div>}
    {!data && !error && <div className="card h-32 animate-pulse" />}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{data?.map(i => (<article key={i._id} className="card space-y-2">
      {p.photo && <Photo src={i.photo} name={i.name} />}
      <div className="font-semibold">{i.name || i.title}</div><div className="text-sm text-ink/70">{p.summary?.(i)}</div>
      <div className="flex flex-wrap gap-2">{p.actions?.(i, load)}{!p.readOnly && <>
        <button className="btn-soft" onClick={() => setEdit(i)} aria-label="Edit"><Pencil size={14} />Edit</button>
        <button className="btn-soft" onClick={() => del(i)} aria-label="Delete"><Trash2 size={14} />Delete</button></>}</div></article>))}</div>
    {edit && <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-2 sm:items-center" role="dialog" aria-modal="true">
      <div className="card max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto">
        <div className="flex justify-between"><h3 className="text-lg font-bold">{edit._id ? 'Edit' : 'Add'} {p.title.toLowerCase()}</h3><button onClick={() => setEdit(null)} aria-label="Close"><X /></button></div>
        {p.fields.map(f => (<label key={f.name} className="block text-sm">{f.label}
          {f.pet || f.type === 'select' ? <select className="input" required={f.required} value={form[f.name] ?? ''} onChange={e => setForm({ ...form, [f.name]: e.target.value })}>
            <option value="">{f.pet ? 'Choose a pet' : 'Choose'}</option>{f.pet ? pets.data?.map(x => <option key={x._id} value={x._id}>{x.name}</option>) : f.options?.map(o => <option key={o}>{o}</option>)}</select>
          : f.type === 'textarea' ? <textarea className="input" rows={3} value={form[f.name] ?? ''} onChange={e => setForm({ ...form, [f.name]: e.target.value })} />
          : f.type === 'checkbox' ? <input type="checkbox" className="ml-2" checked={!!form[f.name]} onChange={e => setForm({ ...form, [f.name]: e.target.checked })} />
          : <input className="input" type={f.type || 'text'} step="any" required={f.required} value={form[f.name] ?? ''} onChange={e => setForm({ ...form, [f.name]: e.target.value })} />}</label>))}
        {msg && <p className="text-sm text-red-700" role="alert">{msg}</p>}
        <button className="btn w-full" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button></div></div>}
  </section>);
}
