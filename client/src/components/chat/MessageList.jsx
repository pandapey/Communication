import { memo, useState } from 'react';
import api from '../../services/api';
import { Avatar } from '../ui/bits';
import toast from 'react-hot-toast';

const SENDER_COLORS = ['#e91e63', '#9c27b0', '#3f51b5', '#009688', '#ff5722', '#795548', '#607d8b', '#008069'];
function senderColor(name = '?') {
  let h = 0;
  for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) % 997;
  return SENDER_COLORS[h % SENDER_COLORS.length];
}

function formatDay(ts) {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'TODAY';
  if (d.toDateString() === yesterday.toDateString()) return 'YESTERDAY';
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' }).toUpperCase();
}

function Ticks({ seen }) {
  return <span className={`text-[14px] leading-none ${seen ? 'wa-tick-read' : 'opacity-60'}`}>{seen ? '✓✓' : '✓✓'}</span>;
}

function FilePreview({ a, mine }) {
  const isImg = a.mimeType?.startsWith('image/');
  const isPdf = a.mimeType === 'application/pdf';
  if (isImg) {
    return (
      <a href={a.url} target="_blank" rel="noreferrer" className="block mt-2 overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 hover:-translate-y-[1px] hover:shadow-card transition-all duration-200">
        <img src={a.url} alt={a.fileName} loading="lazy" className="max-w-[280px] w-full max-h-[240px] object-cover hover:opacity-95 transition-opacity" />
        <span className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] opacity-75 truncate max-w-[280px] bg-black/[.04] dark:bg-white/5">🖼 <span className="truncate">{a.fileName}</span></span>
      </a>
    );
  }
  return (
    <a
      href={a.url}
      target="_blank"
      rel="noreferrer"
      className={`mt-2 flex items-center gap-2.5 rounded-2xl p-2.5 max-w-[280px] border border-black/10 dark:border-white/10 hover:-translate-y-[1px] hover:shadow-card transition-all duration-200 ${mine ? 'bg-emerald-900/10' : 'bg-slate-100 dark:bg-white/10'}`}
    >
      <span className="w-10 h-10 rounded-2xl grid place-items-center text-lg bg-gradient-to-br from-[#00a884] to-[#008069] text-white shrink-0 shadow">{isPdf ? '📄' : '📎'}</span>
      <span className="min-w-0">
        <span className="block truncate font-semibold text-[13px]">{a.fileName}</span>
        <span className="text-[11.5px] opacity-70">{((a.size || 0) / 1024).toFixed(1)} KB • tap to open</span>
      </span>
    </a>
  );
}

function Bubble({ m, mine, isGroup, amAdmin, selectMode, selected, onToggleSelect, onSelect, onReply, onEdit, onDelete, onReact }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.text || '');
  const [showActs, setShowActs] = useState(false);

  const saveEdit = async () => {
    if (!draft.trim()) { toast.error('Message cannot be empty'); return; }
    try {
      await api.put(`/messages/${m._id}`, { text: draft });
      onEdit?.();
      setEditing(false);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Edit failed');
    }
  };

  const actBtn = 'btn-press inline-flex items-center gap-1 text-[12px] font-semibold px-2.5 py-1 rounded-full bg-black/[.06] dark:bg-white/10 text-slate-700 dark:text-slate-200 hover:bg-black/10 dark:hover:bg-white/15 transition-colors';

  if (m.pending) {
    return (
      <div className="flex justify-end msg-in">
        <div className="wa-bubble wa-bubble-out bg-gradient-to-br from-[#d9fdd3] to-[#bff0b6] dark:from-[#005c4b] dark:to-[#004139] px-3.5 py-2 max-w-[80%] text-[14.2px] opacity-90">
          <span className="whitespace-pre-wrap">{m.text}</span>{' '}
          <span className="opacity-60 text-xs" aria-label="Sending">🕐</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex ${mine ? 'justify-end' : 'justify-start'} msg-in group ${selectMode ? 'cursor-pointer' : ''}`}
      onClick={selectMode ? (e) => { e.preventDefault(); e.stopPropagation(); onToggleSelect?.(m._id); } : undefined}
      role={selectMode ? 'button' : undefined}
      aria-label={selectMode ? `Select message: ${(m.text || '').slice(0, 60)}` : undefined}
    >
      <div
        className={`wa-bubble ${mine ? 'wa-bubble-out bg-gradient-to-br from-[#dcf8d4] to-[#c6f2bc] dark:from-[#00614f] dark:to-[#004139] shadow-[0_4px_16px_-6px_rgba(0,128,105,.4)] border border-emerald-900/10 dark:border-white/10' : 'wa-bubble-in bg-white dark:bg-ink-800 border border-slate-200/70 dark:border-white/10 shadow-[0_4px_16px_-8px_rgba(2,6,23,.3)]'} px-3.5 py-2 max-w-[82%] sm:max-w-[68%] text-[14.2px] leading-[1.5] text-slate-900 dark:text-slate-100 ${selected ? '!border-emerald-500 ring-2 ring-emerald-500/60' : ''}`}
      >
        {selectMode && (
          <span
            className={`absolute -left-2 -top-2 z-10 w-6 h-6 rounded-full grid place-items-center text-[12px] font-bold border-2 ${selected ? 'bg-emerald-600 text-white border-emerald-600 shadow' : 'bg-white dark:bg-ink-800 text-transparent border-slate-300 dark:border-white/20'}`}
            aria-hidden
          >✓</span>
        )}
        {!mine && isGroup && (
          <div className="flex items-center gap-1.5 text-[12.5px] font-bold mb-1">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: senderColor(m.sender?.name) }} aria-hidden />
            <span style={{ color: senderColor(m.sender?.name) }}>{m.sender?.name}</span>
          </div>
        )}
        {m.replyTo?.text && (
          <div className={`rounded-xl px-2.5 py-1.5 mb-1.5 border-l-[3px] text-[13px] ${mine ? 'bg-emerald-900/10 border-emerald-700 dark:border-emerald-400' : 'bg-slate-100 dark:bg-white/10 border-[#00a884]'}`}>
            <div className="font-bold text-[11.5px] text-emerald-700 dark:text-emerald-300">{m.replyTo.sender?.name || 'Message'}</div>
            <div className="opacity-75 line-clamp-2 leading-snug">{m.replyTo.text.slice(0, 140)}</div>
          </div>
        )}
        {m.isDeleted ? (
          <span className="flex items-center gap-2 italic text-[13px] text-slate-500 dark:text-slate-400">
            <span>🚫 {m.text}</span>
            {(mine || amAdmin) && !selectMode && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete?.(m); }}
                className="btn-press not-italic text-[11.5px] font-bold px-2 py-0.5 rounded-full text-red-600 dark:text-red-400 bg-red-500/10 hover:bg-red-500/20"
                title="Remove this deleted message permanently"
                aria-label="Remove deleted message permanently"
              >
                Remove
              </button>
            )}
          </span>
        ) : editing ? (
          <span className="flex gap-1.5 items-center min-w-[200px] max-w-full">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false); }}
              className="rounded-xl px-2.5 py-1.5 flex-1 min-w-0 text-[13.5px] text-slate-900 bg-white dark:bg-ink-900 dark:text-white border border-emerald-500/40 outline-none focus:ring-4 focus:ring-emerald-500/15"
              autoFocus
              aria-label="Edit message"
            />
            <button onClick={saveEdit} title="Save edit" aria-label="Save edit" className="btn-press w-7 h-7 grid place-items-center rounded-full bg-emerald-600 text-white text-[13px]">✔</button>
            <button onClick={() => setEditing(false)} className="btn-press w-7 h-7 grid place-items-center rounded-full bg-black/10 dark:bg-white/10 opacity-70 text-[13px]" title="Cancel edit" aria-label="Cancel edit">✕</button>
          </span>
        ) : (
          m.text && (
            <span className="whitespace-pre-wrap">
              {m.text}{' '}
              {m.isEdited && <span className="opacity-50 text-[10.5px]">(edited)</span>}
            </span>
          )
        )}
        {(m.attachments || []).map((a, i) => <FilePreview key={i} a={a} mine={mine} />)}
        {(m.reactions || []).length > 0 && (
          <span className="inline-flex items-center gap-0.5 mt-1.5 bg-white dark:bg-ink-900 border border-slate-200 dark:border-white/10 rounded-full px-2 py-0.5 text-[12px] shadow-sm">
            {(m.reactions || []).slice(0, 3).map((r) => r.emoji).join('')}<span className="text-[10px] font-bold opacity-60 ml-0.5">{m.reactions.length}</span>
          </span>
        )}
        {!selectMode && (
          <span className="flex justify-end items-center gap-1.5 mt-1">
            <span className="text-[10.5px] font-medium opacity-50">{m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
            {mine && <Ticks seen={(m.readBy?.length || 0) > 1} />}
            {!m.isDeleted && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowActs((s) => !s); }}
                className="btn-press text-[12px] px-1.5 rounded-full opacity-60 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/15"
                aria-label="Message actions"
                aria-expanded={showActs}
                title="Reply, react, edit, delete, select"
              >⋯</button>
            )}
          </span>
        )}
        {/* Inline actions — lives INSIDE the bubble so it can never overflow or hide behind the chat */}
        {!selectMode && !m.isDeleted && !editing && (
          <div className={`${showActs ? 'flex' : 'hidden'} group-hover:flex relative z-10 flex-wrap gap-1.5 mt-2 rounded-xl bg-black/[.05] dark:bg-white/[.07] p-1.5 anim-fade-in`}>
            <button className={actBtn} onClick={() => { setShowActs(false); onReply?.(m); }} aria-label="Reply to message">↩ Reply</button>
            <button className={actBtn} onClick={() => { setShowActs(false); onReact?.(m, '❤️'); }} aria-label="React with heart">❤️</button>
            <button className={actBtn} onClick={() => { setShowActs(false); onReact?.(m, '👍'); }} aria-label="React with thumbs up">👍</button>
            <button className={actBtn} onClick={() => { setShowActs(false); onSelect?.(m); }} aria-label="Select messages">☑ Select</button>
            {mine && <button className={actBtn} onClick={() => { setShowActs(false); setDraft(m.text || ''); setEditing(true); }} aria-label="Edit message">✎ Edit</button>}
            {mine && <button className={`${actBtn} !text-red-600 dark:!text-red-400`} onClick={() => { setShowActs(false); onDelete?.(m); }} aria-label="Delete message">🗑 Delete</button>}
          </div>
        )}
      </div>
    </div>
  );
}

const MemoBubble = memo(Bubble);

export default function MessageList({ messages, meId, isGroup, amAdmin, selectMode, selectedIds, onToggleSelect, onSelect, onReply, onEdit, onDelete, onReact }) {
  if (!messages || messages.length === 0) {
    return (
      <div className="h-full grid place-items-center p-8 text-center">
        <div className="anim-fade-up max-w-md rounded-3xl bg-white/80 dark:bg-ink-800/80 backdrop-blur border border-slate-200/60 dark:border-white/10 px-6 py-5 shadow-card">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-emerald-500/20 to-brand-500/20 grid place-items-center text-3xl mb-3">👋</div>
          <div className="font-display font-bold text-slate-900 dark:text-white">Say hello to start</div>
          <div className="text-[13px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">Messages appear here instantly. Be kind, no spam. 🔒 Demo encryption.</div>
        </div>
      </div>
    );
  }
  let lastDay = '';
  return (
    <div className="flex flex-col gap-[7px] px-4 sm:px-10 py-4 pb-8">
      {messages.map((m) => {
        const day = m.createdAt ? formatDay(m.createdAt) : '';
        const showDay = day !== lastDay;
        lastDay = day;
        const mine = String(m.sender?._id || m.sender) === String(meId);
        return (
          <div key={m._id}>
            {showDay && (
              <div className="flex justify-center my-3 anim-fade-in">
                <span className="text-[11px] font-bold uppercase tracking-[0.1em] px-3.5 py-1.5 rounded-full bg-white/85 dark:bg-ink-800/85 backdrop-blur border border-slate-200/60 dark:border-white/10 text-slate-500 dark:text-slate-400 shadow-sm">{day}</span>
              </div>
            )}
            <MemoBubble
              m={m}
              mine={mine}
              isGroup={isGroup}
              amAdmin={amAdmin}
              selectMode={selectMode}
              selected={(selectedIds || []).some((id) => String(id) === String(m._id))}
              onToggleSelect={onToggleSelect}
              onSelect={onSelect}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              onReact={onReact}
            />
          </div>
        );
      })}
    </div>
  );
}

export { Avatar };
