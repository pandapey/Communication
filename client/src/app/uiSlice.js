import { createSlice } from '@reduxjs/toolkit';

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    dark: localStorage.getItem('theme') === 'dark',
    sidebarOpen: true,
    activeTab: 'chats', // chats | groups | users | search
  },
  reducers: {
    toggleDark(state) {
      state.dark = !state.dark;
      localStorage.setItem('theme', state.dark ? 'dark' : 'light');
      document.documentElement.classList.toggle('dark', state.dark);
    },
    initTheme(state) {
      document.documentElement.classList.toggle('dark', state.dark);
    },
    setTab(state, a) { state.activeTab = a.payload; },
    toggleSidebar(state) { state.sidebarOpen = !state.sidebarOpen; },
  },
});

export const { toggleDark, initTheme, setTab, toggleSidebar } = uiSlice.actions;
export default uiSlice.reducer;
