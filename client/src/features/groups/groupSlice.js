import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

export const fetchGroups = createAsyncThunk('groups/list', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/groups');
    return data.groups;
  } catch (e) {
    return rejectWithValue(e.response?.data?.message || 'Failed to load groups');
  }
});

export const markGroupRead = createAsyncThunk('groups/markRead', async (groupId, { rejectWithValue }) => {
  try {
    await api.post(`/groups/${groupId}/read`);
    return groupId;
  } catch (e) {
    return rejectWithValue(e.response?.data?.message || 'Failed to mark group read');
  }
});

const slice = createSlice({
  name: 'groups',
  initialState: { groups: [], status: 'idle', error: null },
  reducers: {
    bumpGroupUnread(state, a) {
      const g = state.groups.find((x) => String(x._id) === String(a.payload));
      if (g) g.unread = (g.unread || 0) + 1;
    },
    clearGroupUnread(state, a) {
      const g = state.groups.find((x) => String(x._id) === String(a.payload));
      if (g) g.unread = 0;
    },
    removeGroup(state, a) {
      state.groups = state.groups.filter((x) => String(x._id) !== String(a.payload));
    },
    upsertGroup(state, a) {
      const i = state.groups.findIndex((x) => String(x._id) === String(a.payload._id));
      if (i >= 0) {
        const unread = state.groups[i].unread || 0;
        state.groups[i] = { ...a.payload, unread: a.payload.unread ?? unread };
      } else {
        state.groups.unshift(a.payload);
      }
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchGroups.pending, (s) => { s.status = 'loading'; s.error = null; });
    b.addCase(fetchGroups.fulfilled, (s, a) => { s.groups = a.payload; s.status = 'ok'; });
    b.addCase(fetchGroups.rejected, (s, a) => { s.status = 'error'; s.error = a.payload; });
    b.addCase(markGroupRead.fulfilled, (s, a) => {
      const g = s.groups.find((x) => String(x._id) === String(a.payload));
      if (g) g.unread = 0;
    });
  },
});

export const { bumpGroupUnread, clearGroupUnread, removeGroup, upsertGroup } = slice.actions;
export default slice.reducer;
