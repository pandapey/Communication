import { useRef, useState, useEffect, lazy, Suspense } from 'react';
import { useSelector } from 'react-redux';
import api, { apiErrorMessage } from '../../services/api';
import { getSocket } from '../../services/socket';
import toast from 'react-hot-toast';

const EmojiPicker = lazy(() => import('emoji-picker-react'));
const MAX_FILES = 5;

export default function Composer({ conversationId, groupId, replyTo, onCancelReply, onSent }) {
  const { user } = useSelector((s) => s.auth);
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [files, setFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const timer = useRef(null);
  const boxRef = useRef(null);
  const sendingRef = useRef(false);
  const room = conversationId ? `dm:${conversationId}` : `group:${groupId}`;

  useEffect(() => {
    const close = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setShowEmoji(false);
    };
    document.addEventListener('mousedown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      clearTimeout(timer.current);
    };
  }, []);

  // Clear draft when switching rooms so a half-typed message never leaks into another chat.
  useEffect(() => {
    setText('');
    setFiles([]);
    setShowEmoji(false);
    onCancelReply?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, groupId]);

  const emitTyping = (isTyping) => {
    try { getSocket()?.emit('typing', { room, isTyping }); } catch {}
  };

  const onChange = (e) => {
    setText(e.target.value);
    emitTyping(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => emitTyping(false), 1200);
  };

  const pickFiles = (e) => {
    const MAX_BYTES = 10 * 1024 * 1024;
    const list = Array.from(e.target.files || []).slice(0, MAX_FILES);
    const tooBig = list.find((f) => f.size > MAX_BYTES);
    if (tooBig) {
      toast.error(`"${tooBig.name}" is over 10MB and was skipped`);
    }
    setFiles(list.filter((f) => f.size <= MAX_BYTES));
    e.target.value = '';
  };

  const send = async () => {
    if ((!text.trim() && files.length === 0) || sending || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const temp = {
      _id: tempId,
      // Use the real user id so the bubble aligns right immediately (no left-flash).
      sender: { _id: user?._id || 'me', name: user?.name || 'You', avatar: user?.avatar || '' },
      text,
      pending: true, createdAt: new Date().toISOString(), attachments: [],
      conversation: conversationId || undefined,
      group: groupId ? { _id: groupId } : undefined,
    };
    onSent?.(temp, 'optimistic', tempId);
    try {
      const fd = new FormData();
      if (conversationId) fd.append('conversationId', conversationId);
      if (groupId) fd.append('groupId', groupId);
      fd.append('text', text);
      if (replyTo?._id && !String(replyTo._id).startsWith('tmp-')) fd.append('replyTo', replyTo._id);
      files.slice(0, MAX_FILES).forEach((f) => fd.append('files', f));
      const { data } = await api.post('/messages', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      onSent?.(data.message, 'real', tempId);
      setText(''); setFiles([]); onCancelReply?.();
      emitTyping(false);
    } catch (e) {
      onSent?.(null, 'error', tempId);
      toast.error(apiErrorMessage(e, 'Send failed'));
    } finally { setSending(false); sendingRef.current = false; }
  };

  const hasContent = text.trim() || files.length > 0;

  return (
    <div className="px-2.5 sm:px-4 py-2.5 shrink-0 bg-white/85 dark:bg-ink-900/85 backdrop-blur-xl border-t border-slate-200/70 dark:border-white/10">
      {replyTo && (
        <div className="mx-1 mb-2 rounded-2xl overflow-hidden flex bg-gradient-to-r from-emerald-500/10 to-brand-500/10 dark:from-emerald-500/15 dark:to-brand-500/15 border border-emerald-500/20 anim-fade-up">
          <div className="w-1 bg-gradient-to-b from-[#00a884] to-[#6366f1]" />
          <div className="flex-1 px-3 py-2 min-w-0">
            <div className="text-[12px] font-bold text-emerald-700 dark:text-emerald-300">{replyTo.sender?.name || 'Message'}</div>
            <div className="text-[13px] text-slate-600 dark:text-slate-300 truncate">{replyTo.text?.slice(0, 100)}</div>
          </div>
          <button onClick={onCancelReply} className="px-3 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 btn-press" aria-label="Cancel reply">✕</button>
        </div>
      )}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2 px-1 anim-fade-up">
          {files.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-full pl-2.5 pr-1.5 py-1 text-[12px] shadow-sm">
              📎 <span className="max-w-[140px] truncate font-medium text-slate-700 dark:text-slate-200">{f.name}</span>
              <button onClick={() => setFiles(files.filter((_, j) => j !== i))} className="w-5 h-5 grid place-items-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 btn-press" aria-label={`Remove ${f.name}`}>✕</button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2 items-end relative" ref={boxRef}>
        {showEmoji && (
          <div className="absolute bottom-14 left-0 z-20 anim-pop shadow-pop rounded-2xl overflow-hidden max-w-[90vw]">
            <Suspense fallback={<div className="bg-white dark:bg-ink-800 rounded-2xl p-6 text-sm text-slate-500">Loading emojis…</div>}>
              <EmojiPicker
                onEmojiClick={(e) => setText((t) => t + e.emoji)}
                theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
                lazyLoadEmojis
              />
            </Suspense>
          </div>
        )}
        <div className="wa-textbox flex-1 flex items-end gap-1 pl-1 pr-2 py-1.5 shadow-[0_4px_20px_-8px_rgba(2,6,23,.25)]">
          <button
            onClick={() => setShowEmoji((s) => !s)}
            className="btn-press w-9 h-9 grid place-items-center rounded-full text-[20px] text-slate-500 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/10 shrink-0"
            title="Add emoji"
            aria-label="Toggle emoji picker"
            aria-expanded={showEmoji}
          >
            {showEmoji ? '✕' : '☺'}
          </button>
          <label className="btn-press w-9 h-9 grid place-items-center rounded-full text-[20px] text-slate-500 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer shrink-0" title="Attach file (max 10MB)">
            +
            <input type="file" multiple className="hidden" onChange={pickFiles} aria-label="Attach files" />
          </label>
          <textarea
            value={text}
            onChange={onChange}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={1}
            placeholder="Type a message…"
            aria-label="Type a message"
            className="flex-1 resize-none bg-transparent outline-none text-[14.5px] leading-[1.4] max-h-[120px] py-2 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </div>
        <button
          onClick={send}
          disabled={sending || !hasContent}
          className={`btn-press w-11 h-11 grid place-items-center rounded-2xl shrink-0 ${hasContent ? 'bg-gradient-to-br from-[#00a884] to-[#008069] text-white shadow-[0_8px_24px_-8px_rgba(0,168,132,.7)] hover:brightness-110' : 'bg-slate-100 dark:bg-white/10 text-slate-400 dark:text-slate-500'}`}
          aria-label="Send message"
          title="Send message (Enter)"
        >
          {sending ? <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin inline-block" /> : <span className="text-[18px] -ml-0.5">➤</span>}
        </button>
      </div>
    </div>
  );
}
