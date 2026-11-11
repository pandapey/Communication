import { useEffect } from 'react';

const GRADIENTS = [
  'from-indigo-500 to-violet-600',
  'from-cyan-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-fuchsia-500 to-purple-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
];

function gradientFor(name = '?') {
  let h = 0;
  for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) % 997;
  return GRADIENTS[h % GRADIENTS.length];
}

export function Logo({ compact = false }) {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <div className="relative w-9 h-9 rounded-2xl bg-gradient-to-br from-[#00a884] via-[#00b894] to-[#6366f1] grid place-items-center text-white shrink-0 shadow-[0_6px_20px_-6px_rgba(0,168,132,.6)]">
        <span className="text-lg font-extrabold tracking-tight">S</span>
        <span className="absolute inset-0 rounded-2xl ring-1 ring-white/30" aria-hidden />
      </div>
      {!compact && (
        <div className="leading-none">
          <div className="font-display font-extrabold text-[16px] tracking-tight text-wa-text dark:text-wa-textdark">SyncSpace</div>
          <div className="text-[11px] text-wa-sub dark:text-wa-subdark font-medium">Team collaboration</div>
        </div>
      )}
    </div>
  );
}

export function Avatar({ user, size = 40, ring = false }) {
  const name = user?.name || '?';
  const initial = (name[0] || '?').toUpperCase();
  const grad = gradientFor(name);
  const style = { width: size, height: size, fontSize: Math.max(12, size * 0.38) };
  const ringCls = ring ? 'ring-2 ring-[#00a884]/60 ring-offset-2 ring-offset-white dark:ring-offset-ink-900 shadow-[0_4px_16px_-4px_rgba(0,168,132,.5)]' : 'ring-1 ring-black/5 dark:ring-white/10';
  if (user?.avatar) {
    return (
      <img
        src={user.avatar}
        alt={name}
        loading="lazy"
        style={style}
        className={`rounded-2xl object-cover shrink-0 ${ringCls}`}
      />
    );
  }
  return (
    <div
      aria-label={name}
      style={style}
      className={`rounded-2xl bg-gradient-to-br ${grad} text-white grid place-items-center font-bold shrink-0 ${ringCls}`}
    >
      {initial}
    </div>
  );
}

export function OnlineDot({ online, pulse = true }) {
  return (
    <span className="relative inline-flex shrink-0" title={online ? 'Online' : 'Offline'}>
      <span className={`inline-block w-2.5 h-2.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-slate-600'}`} />
      {online && pulse && <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-40" />}
    </span>
  );
}

export function Empty({ title, hint, icon = '💬', action }) {
  return (
    <div className="h-full min-h-[320px] grid place-items-center text-center p-8">
      <div className="anim-fade-up max-w-sm">
        <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-brand-500/15 via-violet-500/15 to-emerald-500/15 border border-white/40 dark:border-white/10 grid place-items-center text-4xl shadow-card mb-4"> {icon}</div>
        <div className="font-display font-bold text-slate-800 dark:text-white text-lg">{title}</div>
        <div className="text-sm mt-1.5 text-slate-500 dark:text-slate-400 leading-relaxed">{hint}</div>
        {action && <div className="mt-4 flex justify-center gap-2 flex-wrap">{action}</div>}
      </div>
    </div>
  );
}

export function Spinner({ size = 18 }) {
  return (
    <span
      style={{ width: size, height: size }}
      className="inline-block rounded-full border-2 border-white/40 border-t-white animate-spin"
      aria-label="Loading"
    />
  );
}

export function SpinnerDark({ size = 18 }) {
  return (
    <span
      style={{ width: size, height: size }}
      className="inline-block rounded-full border-2 border-brand-500/30 border-t-brand-600 animate-spin"
      aria-label="Loading"
    />
  );
}

export function SkeletonRow() {
  return (
    <div className="flex gap-3 items-center p-3">
      <div className="skeleton w-10 h-10 !rounded-2xl shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-3 w-2/5" />
        <div className="skeleton h-3 w-3/5" />
      </div>
    </div>
  );
}

export function SkeletonList({ n = 5 }) {
  return (
    <div aria-hidden>
      {Array.from({ length: n }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

export function Badge({ children, tone = 'indigo' }) {
  const tones = {
    indigo: 'bg-brand-600 text-white shadow-glow',
    slate: 'bg-slate-900 text-white dark:bg-white dark:text-slate-900',
    green: 'bg-emerald-500 text-white',
    red: 'bg-rose-500 text-white',
    amber: 'bg-amber-500 text-white',
    glass: 'bg-white/70 dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold leading-5 ${tones[tone] || tones.indigo}`}>
      {children}
    </span>
  );
}

export function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="block text-xs mt-1 text-slate-500 dark:text-slate-400">{hint}</span>}
    </label>
  );
}

export function Modal({ onClose, children, wide = false, label = 'Dialog' }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    // Lock background scroll while open
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 bg-slate-950/55 backdrop-blur-sm grid place-items-center p-4 z-50 anim-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div
        className={`card-premium p-5 sm:p-6 w-full ${wide ? 'max-w-lg' : 'max-w-sm'} anim-pop max-h-[90vh] overflow-y-auto scroll-thin`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
