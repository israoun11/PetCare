import axios from 'axios'; import { useCallback, useEffect, useState } from 'react';
export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1' });
api.interceptors.request.use(c => { const t = localStorage.getItem('token'); if (t) c.headers.Authorization = 'Bearer ' + t; return c; });
export const errMsg = (e: unknown): string => (axios.isAxiosError(e) && e.response?.data?.message) || 'Something went wrong. Please try again.';
export type Item = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export function useLoad(url: string) {
  const [data, setData] = useState<Item[] | null>(null); const [error, setError] = useState('');
  const load = useCallback(() => api.get(url).then(r => { setData(r.data.data); setError(''); }).catch(e => setError(errMsg(e))), [url]);
  useEffect(() => { load(); }, [load]); return { data, error, load };
}
