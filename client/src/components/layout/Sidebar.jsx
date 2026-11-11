import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import api, { apiErrorMessage } from '../../services/api';
import { fetchConversations, selectDM, selectGroup, clearUnread, removeConversation, clearActive } from '../../features/chat/chatSlice';
import { fetchGroups, clearGroupUnread, removeGroup } from '../../features/groups/groupSlice';
import { markGroupRead } from '../../features/groups/groupSlice';
import { setTab } from '../../app/uiSlice';
import { Avatar, SkeletonList } from '../ui/bits';
import toast from 'react-hot-toast';

function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const y = new Date();
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  if (now - d < 7 * 864e5) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function Ticks({ mine, seen }) {
  if (!mine) return null;
  return <span className={`text-[15px] leading-none shrink-0 ${seen ? 'wa-tick-read' : 'text-wa-sub dark:text-wa-subdark'}`}>{seen ? '✓✓' : '✓✓'}</span>;
}

const TABS = [
  { id: 'chats', label: 'Chats' },
  { id: 'groups', label: 'Groups' },
  { id: 'users', label: 'New chat' },
];

export default function Sidebar({ mobile = false, onNavigate, onNewGroup, onOpenInfo }) {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);
  const { conversations, activeConversationId, activeGroupId, convStatus, onlineMap } = useSelector((s) => s.chat);
  const { groups } = useSelector((s) => s.groups);
  const { activeTab } = useSelector((s) => s.ui);
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [menuId, setMenuId] = useState(null);
  const searchRef = useRef(null);
  const usersRef = useRef([]);
  usersRef.current = users;
  // When a preview still points at a deleted message, fetch the latest real
  // message directly so the list shows who actually sent last.
  const [previewFix, setPreviewFix] = useState({});
  useEffect(() => {
    const staleDm = conversations.filter((c) => c.lastMessage?.isDeleted);
    const staleG = groups.filter((g) => g.lastMessage?.isDeleted);
    if (staleDm.length === 0 && staleG.length === 0) return;
    let alive = true;
    (async () => {
      const entries = {};
      await Promise.all([
        ...staleDm.slice(0, 10).map(async (c) => {
          try {
            const { data } = await api.get('/messages', { params: { conversationId: c._id, limit: 1 } });
            if (data.messages?.[0]) entries[`dm:${c._id}`] = data.messages[0];
          } catch {}
        }),
        ...staleG.slice(0, 10).map(async (g) => {
          try {
            const { data } = await api.get('/messages', { params: { groupId: g._id, limit: 1 } });
            if (data.messages?.[0]) entries[`group:${g._id}`] = data.messages[0];
          } catch {}
        }),
      ]);
      if (alive && Object.keys(entries).length > 0) setPreviewFix((prev) => ({ ...prev, ...entries }));
    })();
    return () => { alive = false; };
  }, [conversations, groups]);

  useEffect(() => {
    dispatch(fetchConversations());
    dispatch(fetchGroups());
  }, [dispatch]);

  useEffect(() => {
    const close = () => setMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  useEffect(() => {
    let alive = true;
    const emptyQ = !q.trim();
    if (emptyQ && activeTab !== 'users') return;
    // Revisiting New chat with cached people: refresh silently in the background
    // and keep the old list on screen, so the tab never flashes empty → loading → list.
    const silent = emptyQ && usersRef.current.length > 0;
    const t = setTimeout(async () => {
      if (!silent) setUsersLoading(true);
      try {
        const { data } = await api.get('/users/search', { params: { q, limit: 15 } });
        if (alive) { setUsers(data.users || []); setUsersLoaded(true); }
      } catch (e) {
        if (alive && q) toast.error(apiErrorMessage(e, 'Search failed'));
        if (alive) setUsersLoaded(true);
      } finally {
        if (alive && !silent) setUsersLoading(false);
      }
    }, silent ? 600 : emptyQ ? 0 : 280);
    return () => { alive = false; clearTimeout(t); };
  }, [q, activeTab]);

  const filteredConvos = useMemo(() => {
    // Hide empty chats (no messages yet) — opening a person doesn't list them
    // until the first message is actually sent.
    let list = conversations.filter((c) => c.lastMessage);
    if (q.trim() && activeTab !== 'users') {
      const needle = q.toLowerCase();
      list = list.filter((c) => c.peer?.name?.toLowerCase().includes(needle) || c.lastMessage?.text?.toLowerCase().includes(needle));
    }
    return list;
  }, [conversations, q, activeTab]);

  const filteredGroups = useMemo(() => {
    let list = groups;
    if (q.trim() && activeTab !== 'users') {
      const needle = q.toLowerCase();
      list = list.filter((g) => g.name?.toLowerCase().includes(needle));
    }
    return list;
  }, [groups, q, activeTab]);

  const handleTab = (id) => {
    if (id === 'users') setQ('');
    dispatch(setTab(id));
    // Focus search when opening New chat so it's obvious what to do next.
    if (id === 'users') setTimeout(() => searchRef.current?.focus(), 50);
  };

  const startDM = async (userId) => {
    try {
      const { data } = await api.post('/conversations/dm', { userId });
      dispatch(fetchConversations());
      dispatch(selectDM(data.conversation._id));
      dispatch(setTab('chats'));
      setQ('');
      onNavigate?.();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not start conversation'));
    }
  };

  const pickDM = (id) => {
    dispatch(selectDM(id));
    dispatch(clearUnread(id));
    api.post(`/conversations/${id}/read`).catch(() => {});
    onNavigate?.();
  };

  const pickGroup = (id) => {
    dispatch(selectGroup(id));
    dispatch(clearGroupUnread(id));
    dispatch(markGroupRead(id));
    api.post(`/groups/${id}/read`).catch(() => {});
    onNavigate?.();
  };

  const deleteChat = async (e, id) => {
    e.stopPropagation();
    setMenuId(null);
    if (!window.confirm('Delete this chat? Messages will be removed for everyone in this copy.')) return;
    try {
      await api.delete(`/conversations/${id}`);
      dispatch(removeConversation(id));
      dispatch(fetchConversations());
      toast.success('Chat deleted');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not delete chat'));
    }
  };

  const leaveGroup = async (e, id) => {
    e.stopPropagation();
    setMenuId(null);
    if (!window.confirm('Leave this group?')) return;
    try {
      await api.delete(`/groups/${id}/members/${user._id}`);
      dispatch(removeGroup(id));
      if (String(activeGroupId) === String(id)) dispatch(clearActive());
      dispatch(fetchGroups());
      toast.success('Left group');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not leave group'));
    }
  };

  const deleteGroup = async (e, id) => {
    e.stopPropagation();
    setMenuId(null);
    if (!window.confirm('Delete this group for everyone? This cannot be undone.')) return;
    try {
      await api.delete(`/groups/${id}`);
      dispatch(removeGroup(id));
      if (String(activeGroupId) === String(id)) dispatch(clearActive());
      dispatch(fetchGroups());
      toast.success('Group deleted');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Only admins can delete the group'));
    }
  };

  const totalUnread = conversations.reduce((a, c) => a + (c.unread || 0), 0) + groups.reduce((a, g) => a + (g.unread || 0), 0);

  return (
    <div className={`${mobile ? 'w-full' : 'w-[340px] shrink-0'} flex flex-col min-h-0 bg-white/90 dark:bg-ink-900/90 backdrop-blur-xl border-r border-slate-200/70 dark:border-white/10`}>
      {/* search — on top */}
      <div className="px-3 pt-2.5 shrink-0">
        <div className="wa-search flex items-center gap-2 px-3 py-2">
          <span className="text-wa-sub dark:text-wa-subdark text-[15px]">⌕</span>
          <input
            ref={searchRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={activeTab === 'users' ? 'Type a name to find people…' : 'Search chats…'}
            className="bg-transparent flex-1 outline-none text-[14px] text-wa-text dark:text-wa-textdark placeholder:text-wa-sub dark:placeholder:text-wa-subdark"
            aria-label="Search"
          />
          {q && <button onClick={() => setQ('')} className="text-wa-sub text-sm" aria-label="Clear search">✕</button>}
        </div>
      </div>

      {/* Simple nav */}
      <div className="px-3 pb-2 shrink-0 flex gap-1.5 p-1 rounded-2xl bg-slate-100/80 dark:bg-white/5 mx-3 mt-2" role="tablist" aria-label="Chat navigation">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={activeTab === t.id}
            onClick={() => handleTab(t.id)}
            className={`seg-tab flex-1 rounded-xl px-2 py-2 text-[13px] font-bold ${activeTab === t.id ? 'bg-white dark:bg-ink-800 text-slate-900 dark:text-white shadow-card' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
          >
            {t.label}
            {t.id === 'chats' && totalUnread > 0 && (
              <span className="ml-1 text-[10px] font-bold text-white bg-gradient-to-r from-[#00a884] to-[#6366f1] rounded-full px-1.5 py-0.5">{totalUnread > 99 ? '99+' : totalUnread}</span>
            )}
          </button>
        ))}
      </div>

      {/* list */}
      <div className="flex-1 overflow-y-auto scroll-thin pb-3" role="tabpanel">
        {activeTab === 'users' ? (
          <>
            {users.length === 0 && (!usersLoaded || usersLoading) && <SkeletonList n={4} />}
            {usersLoaded && !usersLoading && users.length === 0 && (
              <div className="p-6 text-center text-sm text-wa-sub dark:text-wa-subdark">
                {q ? 'No people found. Try another name.' : 'No teammates found yet.'}
              </div>
            )}
            {users.map((u) => {
              const online = onlineMap[u._id] ?? u.isOnline;
              return (
                <button
                  key={u._id}
                  onClick={() => startDM(u._id)}
                  className="w-full flex gap-3 items-center px-3 py-2.5 text-left hover:bg-black/[.04] dark:hover:bg-white/5 transition-colors"
                >
                  <Avatar user={u} size={48} />
                  <div className="flex-1 min-w-0 border-b border-black/5 dark:border-white/5 pb-2.5">
                    <div className="text-[15px] text-wa-text dark:text-wa-textdark truncate">{u.name}</div>
                    <div className="text-[13px] text-wa-sub dark:text-wa-subdark truncate">{online ? 'online' : u.statusText || u.email}</div>
                  </div>
                  <span className="text-[13px] font-bold text-[#00a884] shrink-0">Chat →</span>
                </button>
              );
            })}
          </>
        ) : activeTab === 'groups' ? (
          <>
            {filteredGroups.length === 0 && (
              <div className="p-8 text-center">
                <div className="text-4xl mb-2">👥</div>
                <div className="font-semibold text-[14px] text-wa-text dark:text-wa-textdark">No groups yet</div>
                <div className="text-[13px] text-wa-sub dark:text-wa-subdark mt-1">Create one below to get started.</div>
              </div>
            )}
            {filteredGroups.map((g) => (
              <GroupRow
                key={g._id}
                g={g}
                fix={g.lastMessage?.isDeleted ? previewFix[`group:${g._id}`] : null}
                active={activeGroupId === g._id}
                userId={user?._id}
                isAdmin={g.isAdmin || g.members?.some((m) => String(m.user?._id || m.user) === String(user?._id) && m.role === 'admin')}
                menuId={menuId}
                setMenuId={setMenuId}
                onPick={pickGroup}
                onOpenInfo={onOpenInfo}
                onLeave={leaveGroup}
                onDelete={deleteGroup}
              />
            ))}
          </>
        ) : (
          <>
            {convStatus === 'loading' && <SkeletonList n={5} />}
            {filteredConvos.length > 0 && (
              <div className="px-4 pt-2 pb-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">Direct messages</div>
            )}
            {filteredConvos.map((c) => {
              const active = activeConversationId === c._id;
              const fix = c.lastMessage?.isDeleted ? previewFix[`dm:${c._id}`] : null;
              const shownLast = fix || c.lastMessage;
              const mine = shownLast?.sender?._id === user?._id || shownLast?.sender === user?._id;
              return (
                <div key={c._id} className={`relative group mx-2 rounded-2xl transition-all duration-200 ${active ? 'row-active bg-gradient-to-r from-emerald-500/12 via-brand-500/10 to-transparent dark:from-emerald-500/15 dark:via-brand-500/15 shadow-sm' : 'hover:bg-slate-100/80 dark:hover:bg-white/5 hover:-translate-y-[1px]'}`}>
                  <button onClick={() => pickDM(c._id)} className="w-full flex gap-3 items-center px-3 py-2.5 text-left" aria-label={`Open chat with ${c.peer?.name || 'Unknown'}`}>
                    <Avatar user={c.peer} size={48} />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline gap-2">
                        <span className="truncate text-[14.5px] font-semibold text-slate-900 dark:text-white">{c.peer?.name || 'Unknown'}</span>
                        <span className={`text-[11px] shrink-0 font-medium ${(c.unread || 0) > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-400 dark:text-slate-500'}`}>{fmtTime(fix?.createdAt || c.lastMessageAt)}</span>
                      </div>
                      <div className="flex justify-between items-center gap-2 mt-0.5">
                        <span className="text-[13px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                          <Ticks mine={mine} seen={(shownLast?.readBy?.length || 0) > 1} />
                          <span className="truncate">{shownLast?.text || 'No messages yet — tap to open'}</span>
                        </span>
                        <span className="flex items-center gap-1 shrink-0">
                          {(c.unread || 0) > 0 && (
                            <span className="wa-unread-badge min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold grid place-items-center anim-pop">
                              {c.unread > 99 ? '99+' : c.unread}
                            </span>
                          )}
                          <span
                            role="button" tabIndex={0} aria-label="Chat options"
                            onClick={(e) => { e.stopPropagation(); setMenuId(menuId === `dm:${c._id}` ? null : `dm:${c._id}`); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') setMenuId(`dm:${c._id}`); }}
                            className="hidden max-md:grid group-hover:grid w-7 h-7 place-items-center rounded-full text-slate-400 hover:bg-black/10 dark:hover:bg-white/10"
                            title="Chat options"
                          >⋯</span>
                        </span>
                      </div>
                    </div>
                  </button>
                  {menuId === `dm:${c._id}` && (
                    <div className="mx-3 mb-2 flex flex-wrap gap-1.5 rounded-xl bg-black/[.04] dark:bg-white/[.06] p-1.5 anim-fade-in" onClick={(e) => e.stopPropagation()} role="menu">
                      <button onClick={() => { setMenuId(null); onOpenInfo?.('dm', c._id); }} className="btn-press text-[12px] font-semibold px-2.5 py-1 rounded-full bg-black/[.06] dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15">Contact info</button>
                      <button onClick={(e) => deleteChat(e, c._id)} className="btn-press text-[12px] font-semibold px-2.5 py-1 rounded-full text-red-600 dark:text-red-400 bg-black/[.06] dark:bg-white/10 hover:bg-red-50 dark:hover:bg-red-500/10">Delete chat</button>
                    </div>
                  )}
                </div>
              );
            })}

            {filteredGroups.length > 0 && (
              <div className="px-4 pt-3 pb-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">Groups</div>
            )}
            {filteredGroups.map((g) => (
              <GroupRow
                key={g._id}
                g={g}
                fix={g.lastMessage?.isDeleted ? previewFix[`group:${g._id}`] : null}
                active={activeGroupId === g._id}
                userId={user?._id}
                isAdmin={g.isAdmin || g.members?.some((m) => String(m.user?._id || m.user) === String(user?._id) && m.role === 'admin')}
                menuId={menuId}
                setMenuId={setMenuId}
                onPick={pickGroup}
                onOpenInfo={onOpenInfo}
                onLeave={leaveGroup}
                onDelete={deleteGroup}
              />
            ))}

            {filteredConvos.length === 0 && filteredGroups.length === 0 && convStatus === 'ok' && (
              <div className="p-8 text-center">
                <div className="text-4xl mb-2">💬</div>
                <div className="font-semibold text-[14px] text-wa-text dark:text-wa-textdark">No conversations yet</div>
                <div className="text-[13px] text-wa-sub dark:text-wa-subdark mt-1">Go to New chat to find people and send your first message.</div>
              </div>
            )}
          </>
        )}
      </div>
      {/* Create group — only in Groups tab, at the bottom */}
      {activeTab === 'groups' && (
        <div className="p-3 shrink-0 border-t border-slate-200/70 dark:border-white/10">
          <button
            onClick={() => onNewGroup?.()}
            className="btn-primary btn-press w-full !rounded-2xl !py-3"
          >
            + Create new group
          </button>
        </div>
      )}
    </div>
  );
}

function GroupRow({ g, fix, active, userId, isAdmin, menuId, setMenuId, onPick, onOpenInfo, onLeave, onDelete }) {
  const shownLast = fix || g.lastMessage;
  return (
    <div className={`relative group mx-2 rounded-2xl transition-all duration-200 ${active ? 'row-active bg-gradient-to-r from-violet-500/12 via-brand-500/10 to-transparent dark:from-violet-500/15 dark:via-brand-500/15 shadow-sm' : 'hover:bg-slate-100/80 dark:hover:bg-white/5 hover:-translate-y-[1px]'}`}>
      <button onClick={() => onPick(g._id)} className="w-full flex gap-3 items-center px-3 py-2.5 text-left" aria-label={`Open group ${g.name}`}>
        <Avatar user={{ name: g.name, avatar: g.photo }} size={48} />
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-baseline gap-2">
            <span className="truncate text-[14.5px] font-semibold text-slate-900 dark:text-white">{g.name}</span>
            <span className={`text-[11px] shrink-0 font-medium ${(g.unread || 0) > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-400 dark:text-slate-500'}`}>{fmtTime(fix?.createdAt || g.lastMessageAt)}</span>
          </div>
          <div className="flex justify-between items-center gap-2 mt-0.5">
            <span className="text-[13px] text-slate-500 dark:text-slate-400 truncate">
              {shownLast?.sender?.name ? `${shownLast.sender.name}: ` : ''}{shownLast?.text?.slice(0, 60) || `${g.members?.length || 0} members — tap to open`}
            </span>
            <span className="flex items-center gap-1 shrink-0">
              {(g.unread || 0) > 0 && (
                <span className="wa-unread-badge min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold grid place-items-center anim-pop" title={`${g.unread} unread`}>
                  {g.unread > 99 ? '99+' : g.unread}
                </span>
              )}
              <span
                role="button" tabIndex={0} aria-label="Group options"
                onClick={(e) => { e.stopPropagation(); setMenuId(menuId === `g:${g._id}` ? null : `g:${g._id}`); }}
                onKeyDown={(e) => { if (e.key === 'Enter') setMenuId(`g:${g._id}`); }}
                className="hidden max-md:grid group-hover:grid w-7 h-7 place-items-center rounded-full text-slate-400 hover:bg-black/10 dark:hover:bg-white/10"
                title="Group options"
              >⋯</span>
            </span>
          </div>
        </div>
      </button>
      {menuId === `g:${g._id}` && (
        <div className="mx-3 mb-2 flex flex-wrap gap-1.5 rounded-xl bg-black/[.04] dark:bg-white/[.06] p-1.5 anim-fade-in" onClick={(e) => e.stopPropagation()} role="menu">
          <button onClick={() => { setMenuId(null); onOpenInfo?.('group', g._id); }} className="btn-press text-[12px] font-semibold px-2.5 py-1 rounded-full bg-black/[.06] dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15">Group info</button>
          <button onClick={(e) => onLeave(e, g._id)} className="btn-press text-[12px] font-semibold px-2.5 py-1 rounded-full bg-black/[.06] dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15">Leave group</button>
          {isAdmin && <button onClick={(e) => onDelete(e, g._id)} className="btn-press text-[12px] font-semibold px-2.5 py-1 rounded-full text-red-600 dark:text-red-400 bg-black/[.06] dark:bg-white/10 hover:bg-red-50 dark:hover:bg-red-500/10">Delete group</button>}
        </div>
      )}
    </div>
  );
}
