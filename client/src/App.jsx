import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Toaster } from 'react-hot-toast';
import { fetchMe, logoutLocal } from './features/auth/authSlice';
import { initTheme } from './app/uiSlice';
import { RequireAuth } from './hooks/useAuth';
import { Login, Register } from './features/auth/AuthPages';
import { Forgot, Reset } from './features/auth/PasswordPages';
import Dashboard from './features/chat/Dashboard';
import Profile from './features/users/Profile';

function ResetWrap() {
  const { token } = useParams();
  return <Reset token={token} />;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function NotFound() {
  return (
    <div className="min-h-screen grid place-items-center gradient-mesh p-6 text-center relative overflow-hidden">
      <div className="orb w-[420px] h-[420px] bg-brand-500/20 -top-24 -left-24 animate-orb-drift" aria-hidden />
      <div className="anim-fade-up relative z-10">
        <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-brand-600 to-violet-600 grid place-items-center text-white text-3xl font-extrabold shadow-glow mb-4">?</div>
        <div className="text-7xl font-display font-extrabold gradient-text">404</div>
        <div className="font-bold mt-2 text-lg text-slate-900 dark:text-white">Page not found</div>
        <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">The link you followed doesn’t exist.</div>
        <a href="/dashboard" className="btn-primary btn-press mt-5 inline-flex !rounded-full !px-6">← Back to chats</a>
      </div>
    </div>
  );
}

function Boot({ children }) {
  const dispatch = useDispatch();
  const { status } = useSelector((s) => s.auth);
  useEffect(() => {
    dispatch(initTheme());
    const onUnauth = () => dispatch(logoutLocal());
    window.addEventListener('syncspace:unauthorized', onUnauth);
    if (localStorage.getItem('token')) dispatch(fetchMe());
    return () => window.removeEventListener('syncspace:unauthorized', onUnauth);
  }, [dispatch]);

  if (status === 'idle' && localStorage.getItem('token')) {
    return (
      <div className="min-h-screen grid place-items-center gradient-mesh">
        <div className="flex flex-col items-center gap-3 anim-fade-in">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-600 to-violet-600 grid place-items-center text-white font-extrabold text-xl shadow-glow animate-pulse">S</div>
          <div className="text-sm text-slate-500">Loading workspace…</div>
        </div>
      </div>
    );
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Boot>
        <ScrollToTop />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              borderRadius: '14px',
              background: '#111a30',
              color: '#fff',
              border: '1px solid rgba(255,255,255,.12)',
              fontSize: '13px',
            },
            success: { iconTheme: { primary: '#22d3a5', secondary: '#fff' } },
          }}
        />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<Forgot />} />
          <Route path="/reset-password/:token" element={<ResetWrap />} />
          <Route path="/dashboard" element={<RequireAuth><div key="dash" className="page-enter"><Dashboard /></div></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth><div key="prof" className="page-enter"><Profile /></div></RequireAuth>} />
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Boot>
    </BrowserRouter>
  );
}
