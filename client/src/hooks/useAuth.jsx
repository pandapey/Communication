import { useSelector } from 'react-redux';
import { Navigate, useLocation } from 'react-router-dom';

export function RequireAuth({ children }) {
  const { user, status } = useSelector((s) => s.auth);
  const token = localStorage.getItem('token');
  const loc = useLocation();
  if (status === 'loading' && token) {
    return (
      <div className="min-h-screen grid place-items-center gradient-mesh">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-600 to-violet-600 animate-pulse grid place-items-center text-white font-extrabold">S</div>
      </div>
    );
  }
  if (!user && !token) return <Navigate to="/login" state={{ from: loc }} replace />;
  return children;
}

export function useIsMobile() {
  return typeof window !== 'undefined' && window.innerWidth < 768;
}
