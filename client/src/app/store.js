import { configureStore } from '@reduxjs/toolkit';
import auth from '../features/auth/authSlice';
import chat from '../features/chat/chatSlice';
import groups from '../features/groups/groupSlice';
import notifications from '../features/notifications/notificationSlice';
import ui from './uiSlice';

export const store = configureStore({
  reducer: { auth, chat, groups, notifications, ui },
});
