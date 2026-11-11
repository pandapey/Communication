import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { apiErrorMessage } from '../../services/api';
import PasswordInput from '../../components/ui/PasswordInput';
import { Logo, Spinner } from '../../components/ui/bits';

function Shell({ title, children }) {
  return (
    <div className="min-h-screen grid place-items-center gradient-mesh p-4 relative overflow-hidden">
      <div className="orb w-[440px] h-[440px] bg-brand-500/20 -top-24 -left-24 animate-orb-drift" />
      <div className="w-full max-w-sm card-premium p-6 sm:p-8 anim-fade-up relative z-10">
        <div className="flex justify-center mb-4"><Logo /></div>
        <h1 className="font-display font-extrabold text-xl text-center">{title}</h1>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export function Forgot() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email });
      setDone(data.message + (data.debugToken ? ` (dev token: ${data.debugToken})` : ''));
    } catch (err) {
      setDone(apiErrorMessage(err, 'Request failed'));
    } finally { setLoading(false); }
  };
  return (
    <Shell title="Forgot password">
      <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-4">We’ll email you a reset link.</p>
      <form onSubmit={submit} className="space-y-3">
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="Email address" className="input-premium" />
        <button className="btn-primary w-full" disabled={loading}>{loading && <Spinner />} Send reset link</button>
        {done && <div className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl px-3 py-2 break-all">{done}</div>}
        <Link to="/login" className="text-[13px] text-brand-600 dark:text-brand-300 font-semibold block text-center hover:underline">← Back to login</Link>
      </form>
    </Shell>
  );
}

export function Reset({ token }) {
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post(`/auth/reset-password/${token}`, { password });
      setMsg('✅ Password reset! Go to login.');
    } catch (err) { setMsg(apiErrorMessage(err, 'Reset failed')); }
    finally { setLoading(false); }
  };
  return (
    <Shell title="Reset password">
      <form onSubmit={submit} className="space-y-3">
        <PasswordInput placeholder="New password (min 6)" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="btn-primary w-full" disabled={loading}>{loading && <Spinner />} Reset password</button>
        {msg && <div className="text-xs text-center bg-slate-50 dark:bg-white/5 rounded-xl px-3 py-2">{msg}</div>}
        <Link to="/login" className="text-[13px] text-brand-600 dark:text-brand-300 font-semibold block text-center hover:underline">Go to login</Link>
      </form>
    </Shell>
  );
}
