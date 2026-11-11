import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { login, register } from '../../features/auth/authSlice';
import PasswordInput from '../../components/ui/PasswordInput';
import { Logo, Spinner } from '../../components/ui/bits';
import toast from 'react-hot-toast';

function AuthShell({ children, title, subtitle }) {
  return (
    <div className="min-h-screen relative overflow-hidden flex gradient-mesh dark:bg-ink-950">
      <div className="orb w-[520px] h-[520px] bg-brand-500/25 -top-40 -left-32 animate-orb-drift" />
      <div className="orb w-[420px] h-[420px] bg-cyan-400/20 top-1/4 -right-24 animate-orb-drift" style={{ animationDelay: '-6s' }} />
      <div className="orb w-[380px] h-[380px] bg-fuchsia-500/15 bottom-0 left-1/3 animate-orb-drift" style={{ animationDelay: '-3s' }} />

      <div className="flex-1 hidden lg:flex flex-col justify-center px-14 relative z-10 max-w-[560px]">
        <div className="anim-fade-up">
          <Logo />
          <h1 className="font-display font-extrabold text-[42px] leading-[1.05] tracking-tight mt-8">
            Team chat that<br />
            <span className="gradient-text">feels instant.</span>
          </h1>
          <p className="text-slate-600 dark:text-slate-300 mt-4 leading-relaxed">
            {subtitle || 'DMs, groups, files, presence, typing, reactions, mentions and notifications — all real-time.'}
          </p>
          <div className="grid grid-cols-2 gap-3 mt-8">
            {[
              { i: '⚡', t: 'Real-time', d: 'Socket.IO live updates' },
              { i: '🔒', t: 'Secure', d: 'JWT + RBAC + validation' },
              { i: '📎', t: 'File sharing', d: 'Images, PDFs & docs' },
              { i: '🌙', t: 'Dark mode', d: 'Polished day & night' },
            ].map((f, idx) => (
              <div key={f.t} className="glass rounded-2xl p-4 hover-lift anim-fade-up" style={{ '--d': `${idx * 80}ms` }}>
                <div className="text-2xl">{f.i}</div>
                <div className="font-bold text-sm mt-1.5">{f.t}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{f.d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 grid place-items-center p-4 sm:p-8 relative z-10">
        <div className="w-full max-w-[420px]">
          <div className="lg:hidden flex justify-center mb-5 anim-fade-up"><Logo /></div>
          <div className="card-premium p-6 sm:p-8 anim-fade-up shadow-pop" style={{ '--d': '120ms' }}>
            <h2 className="font-display font-extrabold text-2xl tracking-tight">{title}</h2>
            {children}
          </div>
          <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-4">Protected with rate-limiting & secure cookies • v1.0</p>
        </div>
      </div>
    </div>
  );
}

export function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { error } = useSelector((s) => s.auth);
  const dispatch = useDispatch();
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    const email = form.email.trim().toLowerCase();
    if (!email || !form.password) { toast.error('Enter email and password'); return; }
    setLoading(true);
    const r = await dispatch(login({ email, password: form.password }));
    setLoading(false);
    if (r.meta.requestStatus === 'fulfilled') { toast.success('Welcome back! 👋'); nav('/dashboard'); }
    else toast.error(r.payload || 'Login failed');
  };

  return (
    <AuthShell title="Welcome back">
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-5 mt-1">Login to your team workspace</p>
      <form onSubmit={submit} className="space-y-3">
        <input
          className="input-premium"
          type="email"
          required
          autoComplete="email"
          placeholder="Email address"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <PasswordInput placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        {error && <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl px-3 py-2 anim-fade-up">{error}</div>}
        <button className="btn-primary btn-press w-full !py-3" disabled={loading}>
          {loading && <Spinner />} {loading ? 'Signing in…' : 'Login →'}
        </button>
      </form>
      <div className="text-[13px] mt-4 flex justify-between">
        <Link to="/register" className="text-brand-600 dark:text-brand-300 font-semibold hover:underline">Create account</Link>
        <Link to="/forgot-password" className="text-slate-500 dark:text-slate-400 hover:underline">Forgot password?</Link>
      </div>
      <div className="mt-4 bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 rounded-xl px-3 py-2.5">
        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">⚡ Demo accounts — tap to fill (password: password123)</div>
        <div className="flex flex-col gap-1">
          {[
            { email: 'admin@syncspace.app', label: 'Ava Admin' },
            { email: 'liam@syncspace.app', label: 'Liam Dev' },
            { email: 'mia@syncspace.app', label: 'Mia Design' },
            { email: 'noah@syncspace.app', label: 'Noah QA' },
          ].map((d) => (
            <button
              key={d.email}
              type="button"
              onClick={() => setForm({ email: d.email, password: 'password123' })}
              title={`Fill ${d.email}`}
              className={`btn-press text-left text-[12px] rounded-lg px-2 py-1.5 transition-colors ${form.email === d.email ? 'bg-brand-500/15 text-brand-700 dark:text-brand-200 font-bold' : 'text-slate-600 dark:text-slate-300 hover:bg-brand-50 dark:hover:bg-brand-500/10'}`}
            >
              {form.email === d.email ? '● ' : '○ '}{d.label} — <span className="font-mono">{d.email}</span>
            </button>
          ))}
        </div>
      </div>
    </AuthShell>
  );
}

export function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();
  const nav = useNavigate();

  const strength = form.password.length >= 10 ? 'Strong' : form.password.length >= 6 ? 'Okay' : form.password ? 'Weak' : '';

  const submit = async (e) => {
    e.preventDefault();
    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    if (!name) { toast.error('Enter your name'); return; }
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setLoading(true);
    const r = await dispatch(register({ name, email, password: form.password }));
    setLoading(false);
    if (r.meta.requestStatus === 'fulfilled') { toast.success('Workspace created 🎉'); nav('/dashboard'); }
    else toast.error(r.payload || 'Registration failed');
  };

  return (
    <AuthShell title="Join SyncSpace" subtitle="Create your account and start collaborating with your team in seconds.">
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-5 mt-1">Free for teams • No credit card</p>
      <form onSubmit={submit} className="space-y-3">
        <input className="input-premium" placeholder="Full name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" />
        <input className="input-premium" placeholder="Email address" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" />
        <div>
          <PasswordInput placeholder="Password (min 6)" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          {strength && (
            <div className="flex items-center gap-2 mt-1.5 text-xs">
              <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${strength === 'Strong' ? 'w-full bg-emerald-500' : strength === 'Okay' ? 'w-2/3 bg-amber-500' : 'w-1/3 bg-rose-500'}`}
                />
              </div>
              <span className="text-slate-500">{strength}</span>
            </div>
          )}
        </div>
        <button className="btn-primary w-full !py-3" disabled={loading}>
          {loading && <Spinner />} {loading ? 'Creating…' : 'Create account →'}
        </button>
      </form>
      <Link to="/login" className="text-[13px] text-brand-600 dark:text-brand-300 font-semibold block mt-4 hover:underline">← Back to login</Link>
    </AuthShell>
  );
}
