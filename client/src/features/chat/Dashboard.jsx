import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import Topbar from '../../components/layout/Topbar';
import Sidebar from '../../components/layout/Sidebar';
import Composer from '../../components/chat/Composer';
import MessageList from '../../components/chat/MessageList';
import { Avatar, Modal, SpinnerDark } from '../../components/ui/bits';
import api, { apiErrorMessage } from '../../services/api';
import { getSocket } from '../../services/socket';
import { useRealtime } from '../../hooks/useRealtime';
import {
  fetchMessages, fetchConversations, addMessage,
  resolveOptimistic, removeOptimistic, clearUnread, removeConversation, clearActive, selectDM, selectGroup,
} from '../../features/chat/chatSlice';
import { fetchGroups, clearGroupUnread, removeGroup, markGroupRead } from '../../features/groups/groupSlice';
import { fetchNotifications } from '../../features/notifications/notificationSlice';
import { setTab } from '../../app/uiSlice';
import toast from 'react-hot-toast';

export default function Dashboard() {
  useRealtime();
  const dispatch = useDispatch();
  const nav = useNavigate();
  const { user } = useSelector((s) => s.auth);
  const { activeConversationId, activeGroupId, messages, page, pages, typing, msgStatus, msgError, conversations, onlineMap } = useSelector((s) => s.chat);
  const { groups } = useSelector((s) => s.groups);
  const [replyTo, setReplyTo] = useState(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [chatMenu, setChatMenu] = useState(false);
  const [infoOpen, setInfoOpen] = useState(null); // 'dm' | 'group' | null
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const scrollRef = useRef(null);
  const stickBottom = useRef(true);

  const room = activeConversationId ? `dm:${activeConversationId}` : activeGroupId ? `group:${activeGroupId}` : null;
  const isGroup = !!activeGroupId;

  const activeConvo = useMemo(
    () => conversations.find((c) => c._id === activeConversationId),
    [conversations, activeConversationId]
  );
  const activeGroup = useMemo(
    () => groups.find((g) => g._id === activeGroupId),
    [groups, activeGroupId]
  );

  const peerOnline = activeConvo ? (onlineMap[activeConvo.peer?._id] ?? activeConvo.peer?.isOnline) : false;
  const amGroupAdmin = useMemo(() => {
    if (!activeGroup) return false;
    if (activeGroup.isAdmin) return true;
    return activeGroup.members?.some((m) => String(m.user?._id || m.user) === String(user?._id) && m.role === 'admin');
  }, [activeGroup, user?._id]);

  useEffect(() => { dispatch(fetchNotifications()); dispatch(fetchGroups()); }, [dispatch]);

  // Close menus/drawers/selection with Escape for keyboard users.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setChatMenu(false);
        setInfoOpen(null);
        setMobileNav(false);
        setSelectMode(false);
        setSelectedIds([]);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (activeConversationId) {
      dispatch(fetchMessages({ conversationId: activeConversationId, page: 1 }));
      try { getSocket()?.emit('room:join', `dm:${activeConversationId}`); } catch {}
      api.post(`/conversations/${activeConversationId}/read`).then(() => {
        dispatch(fetchConversations());
        dispatch(clearUnread(activeConversationId));
      }).catch(() => {});
      setReplyTo(null); setInfoOpen(null); setChatMenu(false);
      setSelectMode(false); setSelectedIds([]);
      stickBottom.current = true;
    } else if (activeGroupId) {
      dispatch(fetchMessages({ groupId: activeGroupId, page: 1 }));
      try { getSocket()?.emit('room:join', `group:${activeGroupId}`); } catch {}
      dispatch(markGroupRead(activeGroupId));
      api.post(`/groups/${activeGroupId}/read`).then(() => {
        dispatch(fetchGroups());
        dispatch(clearGroupUnread(activeGroupId));
      }).catch(() => {});
      setReplyTo(null); setInfoOpen(null); setChatMenu(false);
      setSelectMode(false); setSelectedIds([]);
      stickBottom.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId, activeGroupId]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  useEffect(() => {
    if (stickBottom.current) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  const loadMore = () => {
    if (page >= pages) return;
    const next = page + 1;
    const el = scrollRef.current;
    const prevH = el?.scrollHeight || 0;
    const p = activeConversationId
      ? dispatch(fetchMessages({ conversationId: activeConversationId, page: next }))
      : dispatch(fetchMessages({ groupId: activeGroupId, page: next }));
    p.then(() => {
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevH;
      });
    });
  };

  const onSent = (msg, kind, tempId) => {
    if (kind === 'optimistic' && msg) dispatch(addMessage(msg));
    if (kind === 'real' && msg) {
      dispatch(resolveOptimistic({ tempId, real: msg }));
      dispatch(fetchConversations());
      dispatch(fetchGroups());
      stickBottom.current = true;
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }));
    }
    if (kind === 'error') dispatch(removeOptimistic(tempId));
  };

  const onReact = async (m, emoji) => {
    try { await api.post(`/messages/${m._id}/reaction`, { emoji }); }
    catch (e) { toast.error(apiErrorMessage(e, 'Reaction failed')); }
  };
  const onDelete = async (m) => {
    const hard = !!m.isDeleted;
    if (!window.confirm(hard ? 'Remove this deleted message permanently? It will disappear for everyone.' : 'Delete this message?')) return;
    try { await api.delete(`/messages/${m._id}`); }
    catch (e) { toast.error(apiErrorMessage(e, 'Delete failed')); }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => (prev.some((x) => String(x) === String(id)) ? prev.filter((x) => String(x) !== String(id)) : [...prev, id]));
  };

  const enterSelect = (m) => {
    setSelectMode(true);
    setSelectedIds(m ? [m._id] : []);
    setChatMenu(false);
  };

  const bulkDelete = async () => {
    const targets = messages.filter(
      (m) => selectedIds.some((id) => String(id) === String(m._id)) &&
        (String(m.sender?._id || m.sender) === String(user?._id) || user?.role === 'admin')
    );
    if (targets.length === 0) { toast.error('Only your own messages can be deleted'); return; }
    if (!window.confirm(`Delete ${targets.length} message${targets.length > 1 ? 's' : ''}? This cannot be undone.`)) return;
    try {
      await Promise.all(targets.map((m) => api.delete(`/messages/${m._id}`)));
      toast.success(`${targets.length} deleted`);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Some deletes failed'));
    } finally {
      setSelectedIds([]);
      setSelectMode(false);
    }
  };
  const onEditDone = () => {
    if (activeConversationId) dispatch(fetchMessages({ conversationId: activeConversationId, page: 1 }));
    else if (activeGroupId) dispatch(fetchMessages({ groupId: activeGroupId, page: 1 }));
  };

  const deleteChat = async () => {
    setChatMenu(false);
    if (!activeConversationId) return;
    if (!window.confirm('Delete this chat? All messages will be removed.')) return;
    try {
      await api.delete(`/conversations/${activeConversationId}`);
      dispatch(removeConversation(activeConversationId));
      dispatch(fetchConversations());
      toast.success('Chat deleted');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not delete chat'));
    }
  };

  const leaveGroup = async () => {
    setChatMenu(false);
    if (!activeGroupId) return;
    if (!window.confirm('Leave this group?')) return;
    try {
      await api.delete(`/groups/${activeGroupId}/members/${user._id}`);
      dispatch(removeGroup(activeGroupId));
      dispatch(clearActive());
      dispatch(fetchGroups());
      toast.success('Left group');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not leave group'));
    }
  };

  const deleteGroup = async () => {
    setChatMenu(false);
    if (!activeGroupId) return;
    if (!window.confirm('Delete this group for everyone? This cannot be undone.')) return;
    try {
      await api.delete(`/groups/${activeGroupId}`);
      dispatch(removeGroup(activeGroupId));
      dispatch(clearActive());
      dispatch(fetchGroups());
      toast.success('Group deleted');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Only admins can delete the group'));
    }
  };

  const openInfo = (kind, id) => {
    if (kind === 'dm' && id) dispatch(selectDM(id));
    if (kind === 'group' && id) {
      dispatch(selectGroup(id));
      dispatch(markGroupRead(id));
    }
    setInfoOpen(kind);
    setMobileNav(false);
  };

  const headerTitle = activeConvo?.peer?.name || activeGroup?.name || '';
  const headerSub = activeConvo
    ? (typing[room] ? `${typing[room]} typing…` : peerOnline ? 'online' : activeConvo.peer?.lastSeen ? `last seen ${new Date(activeConvo.peer.lastSeen).toLocaleString()}` : 'click for contact info')
    : activeGroup
      ? (typing[room] ? `${typing[room]} typing…` : `${activeGroup.members?.length || 0} members • click for group info`)
      : '';

  return (
    <div className="h-screen flex flex-col chat-shell bg-[#f6f7fb] dark:bg-ink-950 dark:text-slate-100 relative overflow-hidden">
      <Topbar onMenu={() => setMobileNav(true)} />

      <div className="flex-1 flex min-h-0 relative">
        {/* desktop sidebar */}
        <div className="hidden md:flex min-h-0">
          <Sidebar onNewGroup={() => setShowGroupModal(true)} onOpenInfo={openInfo} />
        </div>

        {/* mobile drawer / full-screen chat like WhatsApp mobile */}
        {mobileNav && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div className="absolute inset-0 bg-black/50 anim-fade-in" onClick={() => setMobileNav(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-[88vw] max-w-[360px] flex anim-slide-right shadow-pop">
              <Sidebar mobile onNavigate={() => setMobileNav(false)} onNewGroup={() => { setMobileNav(false); setShowGroupModal(true); }} onOpenInfo={openInfo} />
            </div>
          </div>
        )}

        {/* main chat pane */}
        <div className={`flex-1 flex min-w-0 ${room ? 'flex' : 'hidden md:flex'}`}>
          {!room ? (
            <div className="flex-1 hidden md:flex flex-col items-center justify-center text-center p-8 gradient-mesh relative overflow-hidden">
              <div className="orb w-[480px] h-[480px] bg-brand-500/20 -top-32 -left-24 animate-orb-drift" aria-hidden />
              <div className="orb w-[380px] h-[380px] bg-emerald-400/15 top-1/3 -right-20 animate-orb-drift" style={{ animationDelay: '-6s' }} aria-hidden />
              <div className="relative z-10 anim-fade-up">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#00a884] via-[#00b894] to-[#6366f1] grid place-items-center text-4xl mb-4 shadow-[0_16px_40px_-12px_rgba(0,168,132,.6)] text-white">💬</div>
                <div className="font-display font-extrabold text-[30px] tracking-tight text-slate-900 dark:text-white">SyncSpace <span className="gradient-text">Simple Chat</span></div>
                <div className="text-[14px] text-slate-500 dark:text-slate-400 mt-2 max-w-md leading-relaxed mx-auto">
                  Pick a chat on the left to start. Fast, simple, real-time.
                </div>
                <div className="mt-5 w-full max-w-md text-left card-premium p-5 text-[13.5px] leading-relaxed mx-auto">
                  <div className="font-display font-bold mb-3">How to use — 3 steps</div>
                  <div className="flex gap-2.5 py-1.5"><span className="w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 grid place-items-center text-xs font-bold shrink-0">1</span><span><b>New chat</b> tab → click a person → <b>Chat →</b> → type + press ➤.</span></div>
                  <div className="flex gap-2.5 py-1.5"><span className="w-6 h-6 rounded-full bg-brand-500/15 text-brand-700 dark:text-brand-300 grid place-items-center text-xs font-bold shrink-0">2</span><span><b>+ Group</b> → name it → add people → chat together.</span></div>
                  <div className="flex gap-2.5 py-1.5"><span className="w-6 h-6 rounded-full bg-violet-500/15 text-violet-700 dark:text-violet-300 grid place-items-center text-xs font-bold shrink-0">3</span><span>In chat: <b>+</b> file, <b>☺</b> emoji, hover <b>▾</b> for Reply / Edit / Delete.</span></div>
                </div>
                <div className="flex gap-2 mt-5 justify-center flex-wrap">
                  <button className="btn-primary !rounded-full !px-6 !py-3 btn-press" onClick={() => dispatch(setTab('users'))}>✎ Start new chat</button>
                  <button className="btn-ghost !rounded-full !px-6 !py-3 btn-press" onClick={() => setShowGroupModal(true)}>+ New group</button>
                </div>
                <div className="mt-6 text-[12px] text-slate-400 flex items-center justify-center gap-1.5">🔒 Demo app — messages stay in this workspace</div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex min-w-0">
              <div className="flex-1 flex flex-col min-h-0">
                {/* Chat header */}
                <div className="relative z-30 bg-white/85 dark:bg-ink-900/85 backdrop-blur-xl px-2 sm:px-4 py-2 flex gap-2 items-center shrink-0 border-b border-slate-200/70 dark:border-white/10">
                  <button className="md:hidden btn-press w-9 h-9 grid place-items-center rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300" onClick={() => { dispatch(clearActive()); setMobileNav(true); }} aria-label="Back to chats">←</button>
                  <button onClick={() => setInfoOpen(isGroup ? 'group' : 'dm')} className="flex items-center gap-3 flex-1 min-w-0 text-left rounded-2xl px-2 py-1 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" aria-label="Open conversation info">
                    <Avatar user={activeConvo?.peer || { name: activeGroup?.name, avatar: activeGroup?.photo }} size={40} />
                    <span className="flex-1 min-w-0">
                      <span className="block truncate text-[15px] font-bold text-slate-900 dark:text-white">{headerTitle || 'Conversation'}</span>
                      <span className="flex items-center gap-1.5 truncate text-[12px] text-slate-500 dark:text-slate-400">
                        {typing[room] ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-semibold">
                            <span className="typing-dots" aria-hidden><span /><span /><span /></span>
                            {typing[room]} typing…
                          </span>
                        ) : (
                          headerSub
                        )}
                      </span>
                    </span>
                  </button>
                  <div className="relative">
                    <button onClick={() => setChatMenu((s) => !s)} className="btn-press w-9 h-9 grid place-items-center rounded-xl border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-300 hover:shadow-card text-xl" aria-label="Chat menu" aria-expanded={chatMenu} aria-haspopup="menu">⋮</button>
                    {chatMenu && (
                      <div className="absolute right-0 top-11 z-50 w-52 card-premium p-1.5 anim-pop" role="menu" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => enterSelect(null)} className="w-full text-left px-4 py-2.5 text-[14px] rounded-xl hover:bg-slate-100 dark:hover:bg-white/10">☑ Select messages</button>
                        <button onClick={() => { setChatMenu(false); setInfoOpen(isGroup ? 'group' : 'dm'); }} className="w-full text-left px-4 py-2.5 text-[14px] rounded-xl hover:bg-slate-100 dark:hover:bg-white/10">{isGroup ? 'Group info' : 'Contact info'}</button>
                        {!isGroup && <button onClick={deleteChat} className="w-full text-left px-4 py-2.5 text-[14px] rounded-xl hover:bg-slate-100 dark:hover:bg-white/10">Delete chat</button>}
                        {isGroup && <button onClick={leaveGroup} className="w-full text-left px-4 py-2.5 text-[14px] rounded-xl hover:bg-slate-100 dark:hover:bg-white/10">Leave group</button>}
                        {isGroup && amGroupAdmin && <button onClick={deleteGroup} className="w-full text-left px-4 py-2.5 text-[14px] rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10">Delete group</button>}
                        {isGroup && !amGroupAdmin && <div className="px-4 py-2 text-[12px] text-slate-400">Only admins can delete this group</div>}
                      </div>
                    )}
                  </div>
                </div>

                {/* multi-select bar */}
                {selectMode && (
                  <div className="flex items-center gap-2 px-3 py-2 shrink-0 bg-white/90 dark:bg-ink-900/90 backdrop-blur-xl border-b border-slate-200/70 dark:border-white/10 anim-fade-in">
                    <span className="text-[13px] font-bold text-slate-900 dark:text-white">{selectedIds.length} selected</span>
                    <div className="flex-1" />
                    <button
                      onClick={bulkDelete}
                      disabled={selectedIds.length === 0}
                      className="btn-press text-[12.5px] font-bold px-3.5 py-1.5 rounded-full bg-red-600 text-white hover:brightness-110 disabled:opacity-50"
                    >
                      🗑 Delete{selectedIds.length > 1 ? ` (${selectedIds.length})` : ''}
                    </button>
                    <button
                      onClick={() => { setSelectMode(false); setSelectedIds([]); }}
                      className="btn-press text-[12.5px] font-bold px-3.5 py-1.5 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {/* load older strip */}
                <div className="wa-chat-bg flex justify-center pt-3 shrink-0">
                  <button onClick={loadMore} disabled={page >= pages || msgStatus === 'loading'} className="btn-press text-[12px] font-bold px-4 py-1.5 rounded-full bg-white/90 dark:bg-ink-800/90 backdrop-blur border border-slate-200/60 dark:border-white/10 shadow-sm text-slate-500 dark:text-slate-400 disabled:opacity-50">
                    {page >= pages ? '— End of chat history —' : `Load older messages (${page}/${pages})`}
                  </button>
                </div>

                {/* messages */}
                <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto scroll-thin wa-chat-bg">
                  {msgStatus === 'loading' && messages.length === 0 ? (
                    <div className="p-6 space-y-2 max-w-3xl mx-auto">
                      {[65, 40, 55].map((w, i) => (
                        <div key={i} className={`flex ${i % 2 ? 'justify-start' : 'justify-end'}`}>
                          <div className="skeleton h-10" style={{ width: `${w}%`, borderRadius: 8 }} />
                        </div>
                      ))}
                      <div className="flex justify-center pt-2"><SpinnerDark /></div>
                    </div>
                  ) : msgStatus === 'error' ? (
                    <div className="h-full grid place-items-center p-8 text-center">
                      <div className="bg-white dark:bg-wa-headerdark rounded-lg shadow px-6 py-5">
                        <div className="font-semibold text-[14px]">Couldn’t load messages</div>
                        <div className="text-[13px] text-wa-sub mt-1">{msgError}</div>
                        <button className="mt-3 px-4 py-2 rounded-full bg-[#00a884] text-white text-[13px]" onClick={onEditDone}>Retry</button>
                      </div>
                    </div>
                  ) : (
                    <MessageList
                      messages={messages}
                      meId={user?._id}
                      isGroup={isGroup}
                      amAdmin={isGroup ? amGroupAdmin : user?.role === 'admin'}
                      selectMode={selectMode}
                      selectedIds={selectedIds}
                      onToggleSelect={toggleSelect}
                      onSelect={enterSelect}
                      onReply={setReplyTo}
                      onEdit={onEditDone}
                      onDelete={onDelete}
                      onReact={onReact}
                    />
                  )}
                </div>

                <Composer conversationId={activeConversationId} groupId={activeGroupId} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} onSent={onSent} />
              </div>

              {/* Right info drawer — scrolls when details are long */}
              {infoOpen && (
                <div className="hidden lg:flex w-[320px] shrink-0 bg-white/90 dark:bg-ink-900/90 backdrop-blur-xl border-l border-slate-200/70 dark:border-white/10 flex-col min-h-0 max-h-full overflow-hidden anim-slide-right">
                  {infoOpen === 'dm' && activeConvo ? (
                    <ContactInfo peer={activeConvo.peer} online={peerOnline} onClose={() => setInfoOpen(null)} onDelete={deleteChat} />
                  ) : activeGroup ? (
                    <GroupInfo
                      group={activeGroup}
                      meId={user?._id}
                      amAdmin={amGroupAdmin}
                      onClose={() => setInfoOpen(null)}
                      onChanged={() => { dispatch(fetchGroups()); }}
                      onLeave={leaveGroup}
                      onDelete={deleteGroup}
                    />
                  ) : null}
                </div>
              )}
              {/* mobile info as overlay */}
              {infoOpen && (
                <div className="fixed inset-0 z-40 lg:hidden">
                  <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm anim-fade-in" onClick={() => setInfoOpen(null)} />
                  <div className="absolute right-0 top-0 bottom-0 w-[88vw] max-w-[360px] bg-white dark:bg-ink-900 flex flex-col anim-slide-right overflow-y-auto shadow-pop">
                    {infoOpen === 'dm' && activeConvo ? (
                      <ContactInfo peer={activeConvo.peer} online={peerOnline} onClose={() => setInfoOpen(null)} onDelete={deleteChat} />
                    ) : activeGroup ? (
                      <GroupInfo group={activeGroup} meId={user?._id} amAdmin={amGroupAdmin} onClose={() => setInfoOpen(null)} onChanged={() => { dispatch(fetchGroups()); }} onLeave={leaveGroup} onDelete={deleteGroup} />
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {showGroupModal && <GroupModal onClose={() => { setShowGroupModal(false); dispatch(fetchGroups()); }} />}
    </div>
  );
}

function ContactInfo({ peer, online, onClose, onDelete }) {
  return (
    <div className="flex flex-col min-h-0 flex-1 overflow-y-auto scroll-thin pb-4 anim-fade-up">
      <div className="px-3 py-3 flex items-center gap-3 sticky top-0 bg-white/85 dark:bg-ink-900/85 backdrop-blur-xl border-b border-slate-200/60 dark:border-white/10 z-10">
        <button onClick={onClose} className="btn-press w-8 h-8 grid place-items-center rounded-xl border border-slate-200 dark:border-white/10" aria-label="Close contact info">✕</button>
        <span className="font-display font-bold text-[15px]">Contact info</span>
      </div>
      <div className="p-6 flex flex-col items-center bg-gradient-to-b from-brand-500/10 via-transparent to-transparent">
        <Avatar user={peer} size={104} ring />
        <div className="mt-3 text-[20px] font-display font-extrabold text-slate-900 dark:text-white text-center">{peer?.name}</div>
        <div className="mt-1.5 presence-pill bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
          {online ? '● online now' : peer?.lastSeen ? `last seen ${new Date(peer.lastSeen).toLocaleString()}` : peer?.email}
        </div>
      </div>
      <div className="mx-3 card-premium p-4">
        <div className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400">About</div>
        <div className="text-[14px] mt-1 text-slate-700 dark:text-slate-200">{peer?.statusText || 'Hey there! I am using SyncSpace.'}</div>
      </div>
      <div className="mx-3 mt-3 card-premium p-1.5">
        <button onClick={onDelete} className="btn-press w-full text-left px-4 py-3 text-[14px] font-semibold rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10">🗑 Delete chat</button>
      </div>
    </div>
  );
}

function GroupInfo({ group, meId, amAdmin, onClose, onChanged, onLeave, onDelete }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [name, setName] = useState(group.name);
  const [editingName, setEditingName] = useState(false);

  useEffect(() => {
    // Suggest people even before typing, so the add option is always visible.
    // Existing members are filtered out.
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get('/users/search', { params: { q, limit: 8 } });
        const memberIds = new Set((group.members || []).map((m) => String(m.user?._id || m.user)));
        setResults((data.users || []).filter((u) => !memberIds.has(String(u._id))));
      } catch {}
    }, q.trim() ? 250 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, group]);

  const saveName = async () => {
    try {
      await api.put(`/groups/${group._id}`, { name });
      toast.success('Group name updated');
      setEditingName(false);
      onChanged();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Only admins can rename'));
    }
  };

  const removeMember = async (uid, uname) => {
    if (!window.confirm(`Remove ${uname} from the group?`)) return;
    try {
      await api.delete(`/groups/${group._id}/members/${uid}`);
      toast.success('Member removed');
      onChanged();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not remove member'));
    }
  };

  const makeAdmin = async (uid, role) => {
    try {
      await api.put(`/groups/${group._id}/admin`, { userId: uid, role });
      toast.success(role === 'admin' ? 'Made admin' : 'Removed as admin');
      onChanged();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Admins only'));
    }
  };

  const addMember = async (u) => {
    try {
      await api.post(`/groups/${group._id}/members`, { memberIds: [u._id] });
      toast.success(`${u.name} added`);
      setQ(''); setResults([]);
      onChanged();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not add member'));
    }
  };

  return (
    <div className="flex flex-col min-h-0 flex-1 overflow-y-auto scroll-thin pb-4 anim-fade-up">
      <div className="px-3 py-3 flex items-center gap-3 sticky top-0 z-10 bg-white/85 dark:bg-ink-900/85 backdrop-blur-xl border-b border-slate-200/60 dark:border-white/10">
        <button onClick={onClose} className="btn-press w-8 h-8 grid place-items-center rounded-xl border border-slate-200 dark:border-white/10" aria-label="Close group info">✕</button>
        <span className="font-display font-bold text-[15px]">Group info</span>
      </div>
      <div className="p-6 flex flex-col items-center bg-gradient-to-b from-violet-500/10 via-transparent to-transparent">
        <Avatar user={{ name: group.name, avatar: group.photo }} size={104} ring />
        <div className="mt-3 flex items-center gap-2 w-full justify-center">
          {editingName && amAdmin ? (
            <span className="flex items-center gap-1.5 w-full justify-center">
              <input value={name} onChange={(e) => setName(e.target.value)} className="input-premium !rounded-full !py-1.5 text-[15px] w-44 text-center" maxLength={80} aria-label="Group name" />
              <button onClick={saveName} className="btn-press w-7 h-7 grid place-items-center rounded-full bg-emerald-600 text-white text-[13px]" aria-label="Save group name">✔</button>
              <button onClick={() => { setName(group.name); setEditingName(false); }} className="btn-press w-7 h-7 grid place-items-center rounded-full bg-black/10 dark:bg-white/10 opacity-70" aria-label="Cancel rename">✕</button>
            </span>
          ) : (
            <span className="text-[19px] font-display font-extrabold text-slate-900 dark:text-white text-center truncate max-w-[220px]">{group.name}</span>
          )}
          {amAdmin && !editingName && <button onClick={() => setEditingName(true)} className="btn-press text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm" title="Rename (admin)" aria-label="Rename group">✎</button>}
        </div>
        <div className="mt-1.5 presence-pill bg-violet-500/12 text-violet-700 dark:text-violet-300 border border-violet-500/20">Group • {group.members?.length || 0} members{(group.unread || 0) > 0 && <span className="ml-1 wa-unread-badge px-1.5 py-px rounded-full text-[10px] font-bold">{group.unread} new</span>}</div>
      </div>

      <div className="mx-3 card-premium p-4">
        <div className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400">Description</div>
        <div className="text-[14px] mt-1 text-slate-700 dark:text-slate-200 break-words">{group.description || 'No description.'}</div>
      </div>

      <div className="mx-3 mt-3 card-premium p-2">
        <div className="px-3 py-1.5 text-[13px] text-slate-500 dark:text-slate-400 flex justify-between">
          <span>{group.members?.length || 0} members</span>
          {amAdmin && <span className="text-emerald-700 dark:text-emerald-300 font-semibold">You are admin</span>}
        </div>
        <div className="px-2 pb-1">
          <div className="px-1 pt-1 pb-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400">＋ Add members</div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a name, or pick below…" className="input-premium !rounded-2xl !py-2 text-[13.5px]" aria-label="Add members by name" />
          {results.map((u) => (
            <button key={u._id} onClick={() => addMember(u)} className="btn-press w-full flex items-center gap-2.5 px-2 py-1.5 text-left text-[14px] hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl">
              <Avatar user={u} size={32} />
              <span className="flex-1 truncate font-medium">{u.name}</span>
              <span className="text-emerald-700 dark:text-emerald-300 font-bold text-[13px]">+ Add</span>
            </button>
          ))}
          {results.length === 0 && (
            <div className="px-2 py-1.5 text-[12px] text-slate-400">{q ? 'No people found. Try another name.' : 'Everyone is already in this group 🎉'}</div>
          )}
        </div>
        {(group.members || []).map((m) => {
          const u = m.user && typeof m.user === 'object' ? m.user : { _id: m.user, name: 'Member' };
          const uid = String(u._id || m.user);
          const isMe = uid === String(meId);
          return (
            <div key={uid} className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5">
              <Avatar user={u} size={40} />
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold truncate text-slate-900 dark:text-white">{u.name} {isMe && <span className="text-slate-400 text-[12px] font-normal">(you)</span>}</div>
                <div className="text-[12px] text-slate-500 dark:text-slate-400 truncate">{m.role === 'admin' ? 'Group admin' : u.statusText || 'Member'}</div>
              </div>
              {m.role === 'admin' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">ADMIN</span>}
              {amAdmin && !isMe && (
                <span className="flex gap-1 shrink-0">
                  <button onClick={() => makeAdmin(uid, m.role === 'admin' ? 'member' : 'admin')} className="btn-press text-[11px] font-bold px-2 py-1 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15" title="Toggle admin">
                    {m.role === 'admin' ? 'Demote' : 'Make admin'}
                  </button>
                  <button onClick={() => removeMember(uid, u.name)} className="btn-press text-[11px] font-bold px-2 py-1 rounded-full text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10" title="Remove member (admin)">
                    Remove
                  </button>
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mx-3 mt-3 card-premium p-1.5">
        <button onClick={onLeave} className="btn-press w-full text-left px-4 py-3 text-[14px] font-semibold rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10">🚪 Leave group</button>
        {amAdmin
          ? <button onClick={onDelete} className="btn-press w-full text-left px-4 py-3 text-[14px] text-red-700 font-bold rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 border-t border-slate-100 dark:border-white/10">🗑 Delete group (admin)</button>
          : <div className="px-4 py-2.5 text-[12px] text-slate-400 border-t border-slate-100 dark:border-white/10">Only group admins can delete this group.</div>}
      </div>
    </div>
  );
}

function GroupModal({ onClose }) {
  const [name, setName] = useState('');
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [memberIds, setMemberIds] = useState([]);
  const [memberNames, setMemberNames] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get('/users/search', { params: { q, limit: 8 } });
        setResults(data.users || []);
      } catch {}
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const toggleMember = (u) => {
    if (memberIds.includes(u._id)) {
      setMemberIds(memberIds.filter((id) => id !== u._id));
    } else {
      setMemberIds([...memberIds, u._id]);
      setMemberNames({ ...memberNames, [u._id]: u.name });
    }
  };

  const create = async () => {
    if (!name.trim()) { setError('Give your group a name'); return; }
    setSaving(true); setError('');
    try {
      await api.post('/groups', { name: name.trim(), description: '', memberIds });
      toast.success('Group created 🎉');
      onClose();
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not create group'));
    } finally { setSaving(false); }
  };

  return (
    <Modal onClose={onClose} wide label="Create new group">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500 to-brand-600 grid place-items-center text-white text-xl shadow-glow">👥</div>
        <div>
          <h2 className="font-display font-extrabold text-[18px]">New group</h2>
          <p className="text-[13px] text-slate-500 dark:text-slate-400">Name it, add people, start chatting.</p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Group subject (e.g. Design team)" className="input-premium !rounded-2xl !py-3" autoFocus maxLength={80} aria-label="Group name" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people to add…" className="input-premium !rounded-2xl" aria-label="Search people to add" />
        {results.length > 0 && (
          <div className="border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-white/5 anim-fade-up">
            {results.map((u) => (
              <button key={u._id} onClick={() => toggleMember(u)} className="btn-press w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-white/5">
                <Avatar user={u} size={32} />
                <span className="flex-1 truncate font-semibold">{u.name}</span>
                <span className={`text-[12px] font-bold px-2.5 py-1 rounded-full ${memberIds.includes(u._id) ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-slate-100 dark:bg-white/10 text-slate-500'}`}>
                  {memberIds.includes(u._id) ? '✓ Added' : '+ Add'}
                </span>
              </button>
            ))}
          </div>
        )}
        {memberIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5 anim-fade-up">
            {memberIds.map((id) => (
              <span key={id} className="inline-flex items-center gap-1.5 bg-gradient-to-r from-emerald-500/15 to-brand-500/15 border border-emerald-500/20 text-emerald-800 dark:text-emerald-200 rounded-full px-2.5 py-1 text-[12.5px] font-semibold">
                {memberNames[id] || id.slice(0, 6)}
                <button onClick={() => setMemberIds(memberIds.filter((x) => x !== id))} className="font-bold btn-press" aria-label={`Remove ${memberNames[id] || 'member'}`}>✕</button>
              </span>
            ))}
          </div>
        )}
        {error && <div className="text-[13.5px] text-red-600 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl px-3 py-2 anim-fade-up">{error}</div>}
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="btn-ghost flex-1 !rounded-full !py-3 btn-press">Cancel</button>
          <button onClick={create} disabled={saving} className="btn-primary flex-1 !rounded-full !py-3 btn-press disabled:opacity-60">
            {saving ? 'Creating…' : `Create group${memberIds.length ? ` (${memberIds.length + 1})` : ''}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
