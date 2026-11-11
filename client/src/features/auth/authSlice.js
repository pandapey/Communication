import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

export const fetchMe = createAsyncThunk('auth/me', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/auth/me');
    return data.user;
  } catch (e) {
    return rejectWithValue(e.response?.data?.message || 'Session expired');
  }
});
export const login = createAsyncThunk('auth/login', async (payload, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/auth/login', payload);
    localStorage.setItem('token', data.token);
    return data;
  } catch (e) { return rejectWithValue(e.response?.data?.message || 'Login failed'); }
});
export const register = createAsyncThunk('auth/register', async (payload, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/auth/register', payload);
    localStorage.setItem('token', data.token);
    return data;
  } catch (e) { return rejectWithValue(e.response?.data?.message || 'Register failed'); }
});

const slice = createSlice({
  name: 'auth',
  initialState: { user: null, status: 'idle', error: null },
  reducers: {
    logoutLocal(state) { state.user = null; state.status = 'idle'; state.error = null; localStorage.removeItem('token'); },
    setUser(state, a) { state.user = a.payload; },
  },
  extraReducers: (b) => {
    b.addCase(fetchMe.pending, (s) => { s.status = 'loading'; });
    b.addCase(fetchMe.fulfilled, (s, a) => { s.user = a.payload; s.status = 'ok'; s.error = null; });
    b.addCase(fetchMe.rejected, (s, a) => {
      s.status = 'error'; s.user = null;
      // invalid token → drop it so RequireAuth redirects cleanly
      localStorage.removeItem('token');
      s.error = a.payload;
    });
    b.addCase(login.fulfilled, (s, a) => { s.user = a.payload.user; s.status = 'ok'; s.error = null; });
    b.addCase(login.rejected, (s, a) => { s.error = a.payload; });
    b.addCase(register.fulfilled, (s, a) => { s.user = a.payload.user; s.status = 'ok'; s.error = null; });
    b.addCase(register.rejected, (s, a) => { s.error = a.payload; });
  },
});

export const { logoutLocal, setUser } = slice.actions;
export default slice.reducer;
