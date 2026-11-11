import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

export const fetchNotifications = createAsyncThunk('notif/list', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/notifications?limit=20');
    return data;
  } catch (e) {
    return rejectWithValue(e.response?.data?.message || 'Failed to load notifications');
  }
});

export const markOneRead = createAsyncThunk('notif/readOne', async (id, { rejectWithValue }) => {
  try {
    await api.put(`/notifications/${id}/read`);
    return id;
  } catch (e) {
    return rejectWithValue(e.response?.data?.message || 'Could not mark as read');
  }
});

export const markAllRead = createAsyncThunk('notif/readAll', async (_, { rejectWithValue }) => {
  try {
    await api.put('/notifications/read-all');
    return true;
  } catch (e) {
    return rejectWithValue(e.response?.data?.message || 'Could not mark all as read');
  }
});

const slice = createSlice({
  name: 'notifications',
  initialState: { items: [], unread: 0, status: 'idle', error: null, markingAll: false },
  reducers: {
    push(state, a) {
      // dedupe by _id (prevents double-count when socket + poll deliver same item)
      if (!a.payload?._id) return;
      if (state.items.find((n) => n._id === a.payload._id)) return;
      state.items.unshift(a.payload);
      if (!a.payload.isRead) state.unread += 1;
    },
    markAll(state) { state.items = state.items.map((n) => ({ ...n, isRead: true })); state.unread = 0; },
    markOne(state, a) {
      state.items = state.items.map((n) => (n._id === a.payload ? { ...n, isRead: true } : n));
      state.unread = state.items.filter((n) => !n.isRead).length;
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchNotifications.pending, (s) => { s.status = 'loading'; s.error = null; });
    b.addCase(fetchNotifications.fulfilled, (s, a) => {
      s.items = a.payload.notifications || [];
      s.unread = a.payload.unread ?? s.items.filter((n) => !n.isRead).length;
      s.status = 'ok';
    });
    b.addCase(fetchNotifications.rejected, (s, a) => { s.status = 'error'; s.error = a.payload; });
    b.addCase(markOneRead.fulfilled, (s, a) => {
      s.items = s.items.map((n) => (n._id === a.payload ? { ...n, isRead: true } : n));
      s.unread = Math.max(0, s.unread - 1);
      // keep count truthful even if server and client drifted
      const recomputed = s.items.filter((n) => !n.isRead).length;
      if (recomputed !== s.unread) s.unread = recomputed;
    });
    b.addCase(markAllRead.pending, (s) => { s.markingAll = true; });
    b.addCase(markAllRead.fulfilled, (s) => {
      s.items = s.items.map((n) => ({ ...n, isRead: true }));
      s.unread = 0;
      s.markingAll = false;
    });
    b.addCase(markAllRead.rejected, (s) => { s.markingAll = false; });
  },
});

export const { push, markAll, markOne } = slice.actions;
export default slice.reducer;
