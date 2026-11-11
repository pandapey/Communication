import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { connectSocket, getSocket } from '../services/socket';
import {
  addMessage, updateMessage, removeMessage, removeMessageHard, setTyping,
  setPresence, bumpUnread, clearUnread, clearActive,
} from '../features/chat/chatSlice';
import { fetchGroups, bumpGroupUnread, clearGroupUnread, removeGroup, upsertGroup } from '../features/groups/groupSlice';
import { fetchConversations } from '../features/chat/chatSlice';
import toast from 'react-hot-toast';
import api from '../services/api';

function groupIdOf(msg) {
  if (!msg?.group) return null;
  if (typeof msg.group === 'string') return msg.group;
  return msg.group._id || null;
}

export function useRealtime() {
  const dispatch = useDispatch();
  const { conversations, activeConversationId, activeGroupId } = useSelector((s) => s.chat);
  const { groups } = useSelector((s) => s.groups);
  const { user } = useSelector((s) => s.auth);
  const convRef = useRef(conversations);
  convRef.current = conversations;
  const groupRef = useRef(groups);
  groupRef.current = groups;
  const activeRef = useRef({ dm: activeConversationId, group: activeGroupId });
  activeRef.current = { dm: activeConversationId, group: activeGroupId };

  // 1) connect once per user
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !user) return;
    const socket = connectSocket(token);

    const joinAll = () => {
      socket.emit('rooms:join', {
        conversations: convRef.current.map((c) => c._id),
        groups: groupRef.current.map((g) => g._id),
      });
    };

    const onConnect = () => joinAll();

    socket.on('connect', onConnect);
    // initial join (in case already connected)
    if (socket.connected) joinAll();

    socket.on('message:new', (msg) => {
      const isMine = String(msg.sender?._id || msg.sender) === String(user._id);
      dispatch(addMessage(msg));
      const { dm, group } = activeRef.current;
      const msgConvo = msg.conversation ? String(msg.conversation) : null;
      const msgGroup = groupIdOf(msg) ? String(groupIdOf(msg)) : null;
      if (msgConvo && msgConvo === String(dm || '')) {
        // viewing this DM → mark read live
        api.post(`/conversations/${msg.conversation}/read`).catch(() => {});
        dispatch(clearUnread(msg.conversation));
      } else if (msgGroup && msgGroup === String(group || '')) {
        // viewing this group → mark read live (no list refetch to avoid flicker)
        api.post(`/groups/${msgGroup}/read`).catch(() => {});
        dispatch(clearGroupUnread(msgGroup));
      } else if (!isMine) {
        if (msgConvo) {
          dispatch(bumpUnread(msgConvo));
          dispatch(fetchConversations());
        }
        if (msgGroup) {
          dispatch(bumpGroupUnread(msgGroup));
          dispatch(fetchGroups());
        }
        toast.success(`New message from ${msg.sender?.name || 'team'}`, { duration: 2600 });
      }
      // Note: own-message previews are refreshed by the POST response handler
      // (Dashboard onSent) — no extra fetch here to avoid 2x requests per send.
      socket.emit('message:delivered', { messageId: msg._id });
    });
    socket.on('message:updated', (msg) => dispatch(updateMessage(msg)));
    socket.on('message:deleted', (p) => {
      if (p?.hard) dispatch(removeMessageHard(p._id));
      else dispatch(removeMessage(p));
      // Refresh sidebar previews so the deleted text disappears from the chat list too.
      if (p?.conversation) dispatch(fetchConversations());
      if (p?.group) dispatch(fetchGroups());
    });
    socket.on('message:seen', () => {
      dispatch(fetchConversations());
    });
    socket.on('typing', ({ room, userName, isTyping, userId }) => {
      if (String(userId) === String(user?._id)) return;
      dispatch(setTyping({ room, userName, isTyping }));
    });
    socket.on('presence:online', ({ userId }) => dispatch(setPresence({ userId, online: true })));
    socket.on('presence:offline', ({ userId }) => dispatch(setPresence({ userId, online: false })));
    socket.on('group:created', (g) => {
      if (g?._id) dispatch(upsertGroup(g));
      else dispatch(fetchGroups());
    });
    socket.on('group:updated', (g) => {
      if (g?._id) dispatch(upsertGroup(g));
      else dispatch(fetchGroups());
      dispatch(fetchConversations());
    });
    socket.on('group:deleted', ({ _id }) => {
      dispatch(removeGroup(_id));
      const { group } = activeRef.current;
      if (String(group || '') === String(_id)) dispatch(clearActive());
      toast('A group was deleted', { icon: '🗑️' });
    });

    return () => {
      socket.off('connect', onConnect);
      socket.off('message:new');
      socket.off('message:updated');
      socket.off('message:deleted');
      socket.off('message:seen');
      socket.off('typing');
      socket.off('presence:online');
      socket.off('presence:offline');
      socket.off('group:created');
      socket.off('group:updated');
      socket.off('group:deleted');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  // 2) re-join rooms whenever the list grows (fixes empty join on first connect)
  useEffect(() => {
    const s = getSocket();
    if (!s || !s.connected) return;
    s.emit('rooms:join', {
      conversations: conversations.map((c) => c._id),
      groups: groups.map((g) => g._id),
    });
  }, [conversations.length, groups.length]);
}

export function useSocket() { return getSocket(); }
