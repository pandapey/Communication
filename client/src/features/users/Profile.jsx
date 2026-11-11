import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Topbar from '../../components/layout/Topbar';
import { Avatar, Spinner } from '../../components/ui/bits';
import api, { apiErrorMessage } from '../../services/api';
import { fetchMe } from '../auth/authSlice';
import toast from 'react-hot-toast';

export default function Profile() {
  const { user } = useSelector((s) => s.auth);
  const dispatch = useDispatch();
  const [form, setForm] = useState({ name: '', statusText: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (user) setForm({ name: user.name || '', statusText: user.statusText || '' });
  }, [user?.name, user?.statusText, user?._id]);

  const save = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      await api.put('/users/me', { name: form.name.trim(), statusText: form.statusText });
      await dispatch(fetchMe());
      toast.success('Profile updated ✨');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Update failed'));
    } finally { setSaving(false); }
  };

  const onAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      await api.post('/users/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      await dispatch(fetchMe());
      toast.success('Photo updated 📸');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Upload failed'));
    } finally { setUploading(false); e.target.value = ''; }
  };

  return (
    <div className="min-h-screen gradient-mesh dark:text-slate-100 relative">
      <div className="orb w-[400px] h-[400px] bg-brand-500/20 -top-24 right-0 animate-orb-drift" />
      <Topbar />
      <div className="max-w-2xl mx-auto p-4 sm:p-6 relative z-10">
        {/* cover */}
        <div className="rounded-3xl overflow-hidden shadow-pop anim-fade-up">
          <div className="h-36 sm:h-44 bg-gradient-to-r from-brand-600 via-violet-600 to-cyan-500 relative">
            <div className="absolute inset-0 opacity-30" style={{ background: 'radial-gradient(400px 160px at 20% 20%, white, transparent), radial-gradient(300px 140px at 80% 90%, white, transparent)' }} />
          </div>
          <div className="bg-white dark:bg-ink-800 px-5 sm:px-7 pb-6 -mt-10 relative">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
              <div className="relative shrink-0">
                <Avatar user={user} size={88} ring />
                <label className="absolute inset-0 rounded-2xl bg-slate-950/0 hover:bg-slate-950/45 transition-colors grid place-items-center cursor-pointer group" title="Change photo">
                  <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-bold bg-black/40 rounded-full px-2.5 py-1">
                    {uploading ? '…' : '📷 Change'}
                  </span>
                  <input type="file" accept="image/*" className="hidden" onChange={onAvatar} disabled={uploading} />
                </label>
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <div className="font-display font-extrabold text-xl truncate">{user?.name || '—'}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400 truncate">{user?.email} • <span className="uppercase text-[11px] font-bold tracking-wider">{user?.role}</span></div>
                <div className="text-xs mt-1.5 inline-flex items-center gap-1.5 chip">
                  {user?.isOnline ? '🟢 Online now' : `🕓 Last seen ${user?.lastSeen ? new Date(user.lastSeen).toLocaleString() : 'recently'}`}
                </div>
              </div>
            </div>
            {user?.statusText && (
              <div className="mt-4 text-sm bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 rounded-2xl px-4 py-3">
                “{user.statusText}”
              </div>
            )}
          </div>
        </div>

        {/* edit card */}
        <div className="card-premium p-5 sm:p-7 mt-4 anim-fade-up" style={{ '--d': '100ms' }}>
          <h2 className="font-display font-bold">Edit profile</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">This is how teammates see you.</p>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Display name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-premium mt-1.5" placeholder="Your name" maxLength={60} />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Status</label>
              <input value={form.statusText} onChange={(e) => setForm({ ...form, statusText: e.target.value })} className="input-premium mt-1.5" placeholder="What are you working on?" maxLength={140} />
              <div className="text-[11px] text-slate-400 mt-1 text-right">{form.statusText.length}/140</div>
            </div>
            <div className="flex gap-2">
              <button onClick={save} disabled={saving} className="btn-primary flex-1 sm:flex-none sm:px-8">
                {saving && <Spinner />} {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>

        {/* info cards */}
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          <div className="card-premium p-5 anim-fade-up" style={{ '--d': '160ms' }}>
            <div className="text-2xl">🛡️</div>
            <div className="font-bold text-sm mt-1">Secure account</div>
            <div className="text-xs text-slate-500 mt-0.5">JWT auth, hashed passwords, rate-limited APIs.</div>
          </div>
          <div className="card-premium p-5 anim-fade-up" style={{ '--d': '220ms' }}>
            <div className="text-2xl">⚡</div>
            <div className="font-bold text-sm mt-1">Always in sync</div>
            <div className="text-xs text-slate-500 mt-0.5">Presence, typing & live messages via sockets.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
