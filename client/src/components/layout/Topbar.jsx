import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toggleDark, toggleSidebar } from '../../app/uiSlice';
import { useNavigate } from 'react-router-dom';
import api, { apiErrorMessage } from '../../services/api';
import { logoutLocal } from '../../features/auth/authSlice';
import {
  fetchNotifications, markOneRead, markAllRead,
} from '../../features/notifications/notificationSlice';
import { selectDM, selectGroup } from '../../features/chat/chatSlice';
import { Logo, Avatar, SpinnerDark } from '../ui/bits';
import { disconnectSocket } from '../../services/socket';
import toast from 'react-hot-toast';

function notifIcon(type) {
  if (type === 'mention') return '📣';
  if (type === 'group_invite') return '👥';
  if (type === 'reaction') return '💜';
  if (type === 'new_message') return '💬';
  return '🔔';
}

export default function Topbar({ onMenu }) {
  const dispatch = useDispatch();
  const nav = useNavigate();
  const { user } = useSelector((s) => s.auth);
  const { unread, items, status, markingAll } = useSelector((s) => s.notifications);
  const { dark } = useSelector((s) => s.ui);
  const [showNotif, setShowNotif] = useState(false);
  const [showUser, setShowUser] = useState(false);
  const [markingId, setMarkingId] = useState(null);
  const notifRef = useRef(null);
  const userRef = useRef(null);

  useEffect(() => {
    const close = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false);
      if (userRef.current && !userRef.current.contains(e.target)) setShowUser(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { setShowNotif(false); setShowUser(false); }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  // refresh list each time dropdown opens
  useEffect(() => {
    if (showNotif) dispatch(fetchNotifications());
  }, [showNotif, dispatch]);

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch {}
    try { disconnectSocket(); } catch {}
    dispatch(logoutLocal());
    nav('/login');
  };

  const handleMarkOne = async (e, n) => {
    e.stopPropagation();
    if (n.isRead) return;
    setMarkingId(n._id);
    const r = await dispatch(markOneRead(n._id));
    setMarkingId(null);
    if (r.meta.requestStatus === 'rejected') toast.error(r.payload || 'Could not mark as read');
  };

  const handleMarkAll = async () => {
    if (unread === 0) return;
    const r = await dispatch(markAllRead());
    if (r.meta.requestStatus === 'fulfilled') toast.success('All notifications marked as read');
    else toast.error(r.payload || 'Could not mark all as read');
  };

  const handleOpen = async (n) => {
    // mark as read on view, then jump to the relevant chat
    if (!n.isRead) {
      const r = await dispatch(markOneRead(n._id));
      if (r.meta.requestStatus === 'rejected') toast.error(r.payload || 'Could not mark as read');
    }
    const convoId = n.data?.conversationId;
    const groupId = n.data?.groupId;
    setShowNotif(false);
    if (convoId) {
      dispatch(selectDM(convoId));
      nav('/dashboard');
    } else if (groupId) {
      dispatch(selectGroup(groupId));
      nav('/dashboard');
    }
  };

  return (
    <header className="h-14 shrink-0 flex items-center gap-1 sm:gap-2 px-2 sm:px-4 topbar-glass border-b border-slate-200/70 dark:border-white/10 sticky top-0 z-40">
      <button
        onClick={() => { onMenu?.(); dispatch(toggleSidebar()); }}
        className="icon-btn btn-press md:hidden"
        aria-label="Open navigation menu"
      >
        ☰
      </button>
      <button onClick={() => nav('/dashboard')} className="btn-press hover:opacity-90 rounded-xl" aria-label="Go to chats">
        <Logo />
      </button>
      <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 border-l border-slate-200 dark:border-white/10 pl-3 ml-1">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden />
        Real-time team collaboration
      </div>
      <div className="flex-1" />

      {/* theme */}
      <button
        onClick={() => dispatch(toggleDark())}
        className="icon-btn btn-press"
        aria-label="Toggle dark mode"
        title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        <span className="transition-transform duration-300 inline-block" style={{ transform: dark ? 'rotate(180deg)' : 'none' }}>
          {dark ? '☀️' : '🌙'}
        </span>
      </button>

      {/* notifications */}
      <div className="relative" ref={notifRef}>
        <button
          onClick={() => { setShowNotif((s) => !s); setShowUser(false); }}
          className="icon-btn btn-press relative"
          aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
          aria-expanded={showNotif}
          aria-haspopup="menu"
        >
          <span>🔔</span>
          {unread > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-gradient-to-r from-rose-500 to-orange-500 text-white text-[11px] font-bold grid place-items-center shadow-card anim-pop">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
        {showNotif && (
          <div className="absolute right-0 mt-2 w-[340px] max-w-[88vw] card-premium p-2 anim-pop max-h-[64vh] flex flex-col overflow-hidden">
            <div className="px-3 py-2 flex items-center gap-2">
              <span className="font-display font-bold text-sm">Notifications</span>
              <span className="chip !text-[11px]">{unread} new</span>
              <div className="flex-1" />
              <button
                onClick={() => dispatch(fetchNotifications())}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-semibold"
                title="Refresh"
              >
                ↻
              </button>
            </div>
            <div className="px-2 pb-2">
              <button
                onClick={handleMarkAll}
                disabled={unread === 0 || markingAll}
                className="btn-ghost w-full !py-2 !text-xs disabled:opacity-50"
              >
                {markingAll ? 'Marking…' : unread === 0 ? '✓ All caught up' : `✓ Mark all as read (${unread})`}
              </button>
            </div>
            <div className="overflow-y-auto scroll-thin px-1 pb-1">
              {status === 'loading' && items.length === 0 && (
                <div className="flex justify-center py-8"><SpinnerDark /></div>
              )}
              {status !== 'loading' && items.length === 0 && (
                <div className="px-3 py-6 text-center text-sm text-slate-500">You’re all caught up ✨</div>
              )}
              {items.slice(0, 20).map((n) => (
                <div
                  key={n._id}
                  onClick={() => handleOpen(n)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleOpen(n); }}
                  className={`group px-3 py-2.5 rounded-xl text-sm transition-colors cursor-pointer flex gap-2.5 ${!n.isRead ? 'bg-brand-50 dark:bg-brand-500/10 hover:bg-brand-100 dark:hover:bg-brand-500/15' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}
                  title={n.data?.conversationId || n.data?.groupId ? 'Open conversation' : 'Mark as read'}
                >
                  <span className="text-lg shrink-0 mt-0.5">{notifIcon(n.type)}</span>
                  <span className="flex-1 min-w-0">
                    <span className="font-semibold text-[13px] flex items-center gap-1.5">
                      <span className="truncate">{n.title}</span>
                      {!n.isRead && <span className="w-2 h-2 rounded-full bg-brand-600 shrink-0" aria-label="Unread" />}
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{n.body}</span>
                    <span className="block text-[11px] text-slate-400 mt-1">{n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}</span>
                  </span>
                  {!n.isRead && (
                    <button
                      onClick={(e) => handleMarkOne(e, n)}
                      disabled={markingId === n._id}
                      className="self-start shrink-0 text-[11px] font-bold px-2 py-1 rounded-lg border border-brand-500/30 text-brand-700 dark:text-brand-200 hover:bg-brand-600 hover:text-white hover:border-brand-600 transition-all disabled:opacity-50"
                    >
                      {markingId === n._id ? '…' : '✓ Read'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* user */}
      <div className="relative" ref={userRef}>
        <button
          onClick={() => { setShowUser((s) => !s); setShowNotif(false); }}
          className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 pl-1.5 pr-2.5 py-1.5 hover-lift"
        >
          <Avatar user={user} size={28} />
          <span className="text-sm font-semibold max-w-[90px] truncate hidden sm:block">{user?.name?.split(' ')[0] || 'Account'}</span>
          <span className="text-xs opacity-60">▾</span>
        </button>
        {showUser && (
          <div className="absolute right-0 mt-2 w-52 card-premium p-2 anim-pop">
            <button onClick={() => { setShowUser(false); nav('/dashboard'); }} className="w-full text-left px-3 py-2.5 rounded-xl text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">💬 Chats</button>
            <button onClick={() => { setShowUser(false); nav('/profile'); }} className="w-full text-left px-3 py-2.5 rounded-xl text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">👤 Profile & settings</button>
            <div className="h-px bg-slate-200 dark:bg-white/10 my-1.5" />
            <button onClick={logout} className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">↪ Logout</button>
          </div>
        )}
      </div>
    </header>
  );
}
