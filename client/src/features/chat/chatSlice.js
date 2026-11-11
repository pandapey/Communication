import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

export const fetchConversations = createAsyncThunk('chat/list', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/conversations');
    return data.conversations;
  } catch (e) {
    return rejectWithValue(e.response?.data?.message || 'Failed to load conversations');
  }
});
export const fetchMessages = createAsyncThunk(
  'chat/messages',
  async ({ conversationId, groupId, page = 1, q = '' }, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/messages', { params: { conversationId, groupId, page, limit: 30, q } });
      return { ...data, page, roomKey: conversationId ? `dm:${conversationId}` : `group:${groupId}` };
    } catch (e) {
      return rejectWithValue(e.response?.data?.message || 'Failed to load messages');
    }
  }
);

const slice = createSlice({
  name: 'chat',
  initialState: {
    conversations: [],
    convStatus: 'idle',
    convError: null,
    activeConversationId: null,
    activeGroupId: null,
    messages: [],
    msgStatus: 'idle',
    msgError: null,
    page: 1,
    pages: 1,
    total: 0,
    roomKey: null,
    typing: {}, // room -> userName
    onlineMap: {},
    search: '',
  },
  reducers: {
    selectDM(state, a) {
      state.activeConversationId = a.payload;
      state.activeGroupId = null;
      state.messages = [];
      state.page = 1; state.pages = 1;
      state.msgStatus = 'idle'; state.msgError = null;
      state.roomKey = a.payload ? `dm:${a.payload}` : null;
    },
    selectGroup(state, a) {
      state.activeGroupId = a.payload;
      state.activeConversationId = null;
      state.messages = [];
      state.page = 1; state.pages = 1;
      state.msgStatus = 'idle'; state.msgError = null;
      state.roomKey = a.payload ? `group:${a.payload}` : null;
    },
    addMessage(state, a) {
      const msg = a.payload;
      if (!msg || state.messages.find((m) => m._id === msg._id)) return;
      // Only append if it belongs to the active room (or if no room filter yet)
      const msgRoom = msg.conversation ? `dm:${msg.conversation}` : msg.group ? `group:${typeof msg.group === 'object' ? msg.group._id || msg.group : msg.group}` : null;
      // For populated group objects, fallback: accept if activeGroupId matches either form
      if (state.roomKey && msgRoom && msgRoom !== state.roomKey) {
        // still allow if message carries active ids in another shape
        const activeId = state.activeConversationId || state.activeGroupId;
        const carriesActive =
          String(msg.conversation || '') === String(activeId || '') ||
          String(msg.group?._id || msg.group || '') === String(activeId || '');
        if (!carriesActive) return;
      }
      // If this is the server echo of our own optimistic message,
      // replace the pending temp instead of appending a duplicate.
      // (This was causing "message appears twice until refresh".)
      if (msg._id && !String(msg._id).startsWith('tmp-')) {
        const msgConvo = String(msg.conversation || '');
        const msgGroup = String(msg.group?._id || msg.group || '');
        const pendingIdx = state.messages.findIndex((m) =>
          String(m._id || '').startsWith('tmp-') && m.pending &&
          (m.text || '') === (msg.text || '') &&
          String(m.conversation || '') === msgConvo &&
          String(m.group?._id || m.group || '') === msgGroup
        );
        if (pendingIdx >= 0) {
          state.messages[pendingIdx] = msg;
          return;
        }
      }
      state.messages.push(msg);
    },
    // Replace optimistic temp message with the real server message
    resolveOptimistic(state, a) {
      const { tempId, real } = a.payload;
      const i = state.messages.findIndex((m) => m._id === tempId);
      if (i >= 0) state.messages[i] = real;
      else if (real && !state.messages.find((m) => m._id === real._id)) state.messages.push(real);
      // Dedupe by _id: socket echo may have already added `real`,
      // so replacing temp would leave 2 copies of the same _id.
      if (real) {
        const seen = new Set();
        state.messages = state.messages.filter((m) => {
          if (seen.has(m._id)) return false;
          seen.add(m._id);
          return true;
        });
      }
    },
    removeOptimistic(state, a) {
      state.messages = state.messages.filter((m) => m._id !== a.payload);
    },
    updateMessage(state, a) {
      const i = state.messages.findIndex((m) => m._id === a.payload._id);
      if (i >= 0) state.messages[i] = { ...state.messages[i], ...a.payload };
    },
    removeMessage(state, a) {
      state.messages = state.messages.map((m) => (m._id === a.payload._id ? { ...m, isDeleted: true, text: 'This message was deleted', attachments: [] } : m));
    },
    removeMessageHard(state, a) {
      const id = typeof a.payload === 'string' ? a.payload : a.payload._id;
      state.messages = state.messages.filter((m) => String(m._id) !== String(id));
    },
    setTyping(state, a) {
      const { room, userName, isTyping } = a.payload;
      if (isTyping) state.typing[room] = userName;
      else delete state.typing[room];
    },
    clearTypingFor(state, a) {
      delete state.typing[a.payload];
    },
    setPresence(state, a) {
      const { userId, online } = a.payload;
      state.onlineMap[userId] = online;
    },
    setSearch(state, a) { state.search = a.payload; },
    bumpUnread(state, a) {
      const c = state.conversations.find((x) => x._id === a.payload);
      if (c) c.unread = (c.unread || 0) + 1;
    },
    clearUnread(state, a) {
      const c = state.conversations.find((x) => x._id === a.payload);
      if (c) c.unread = 0;
    },
    removeConversation(state, a) {
      state.conversations = state.conversations.filter((x) => String(x._id) !== String(a.payload));
      if (String(state.activeConversationId) === String(a.payload)) {
        state.activeConversationId = null;
        state.messages = [];
        state.roomKey = null;
      }
    },
    clearActive(state) {
      state.activeConversationId = null;
      state.activeGroupId = null;
      state.messages = [];
      state.roomKey = null;
      state.page = 1; state.pages = 1;
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchConversations.pending, (s) => { s.convStatus = 'loading'; s.convError = null; });
    b.addCase(fetchConversations.fulfilled, (s, a) => { s.conversations = a.payload; s.convStatus = 'ok'; });
    b.addCase(fetchConversations.rejected, (s, a) => { s.convStatus = 'error'; s.convError = a.payload; });
    b.addCase(fetchMessages.pending, (s, a) => {
      // page 1 → full loading; later pages → keep list (infinite scroll)
      if (a.meta.arg.page === 1) { s.msgStatus = 'loading'; s.msgError = null; }
    });
    b.addCase(fetchMessages.fulfilled, (s, a) => {
      // Ignore stale responses from a previous room
      if (a.payload.roomKey !== s.roomKey && s.roomKey) return;
      if (a.payload.page === 1) s.messages = a.payload.messages;
      else s.messages = [...a.payload.messages, ...s.messages];
      s.page = a.payload.page; s.pages = a.payload.pages; s.total = a.payload.total;
      s.msgStatus = 'ok';
    });
    b.addCase(fetchMessages.rejected, (s, a) => { s.msgStatus = 'error'; s.msgError = a.payload; });
  },
});

export const {
  selectDM, selectGroup, addMessage, resolveOptimistic, removeOptimistic,
  updateMessage, removeMessage, removeMessageHard, setTyping, clearTypingFor, setPresence,
  setSearch, bumpUnread, clearUnread, removeConversation, clearActive,
} = slice.actions;
export default slice.reducer;
