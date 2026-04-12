import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const linkClass = (path) =>
    `px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
      location.pathname === path
        ? 'bg-white text-umd-red'
        : 'text-white/90 hover:bg-white/10'
    }`;

  return (
    <nav className="bg-umd-red shadow-lg">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-white font-bold text-lg">
          <span className="text-umd-gold text-xl">T</span>
          TerpDining
        </Link>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link to="/chat" className={linkClass('/chat')}>Chat</Link>
              <Link to="/menu" className={linkClass('/menu')}>Menu</Link>
              <Link to="/recipe" className={linkClass('/recipe')}>Recipe Creator</Link>
              <Link to="/tracker" className={linkClass('/tracker')}>Macro Tracker</Link>
              <div className="ml-4 flex items-center gap-3">
                <span className="text-white/80 text-sm">{user.display_name || user.email}</span>
                <button
                  onClick={logout}
                  className="text-white/70 hover:text-white text-sm underline"
                >
                  Logout
                </button>
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className={linkClass('/login')}>Log In</Link>
              <Link to="/register" className={linkClass('/register')}>Sign Up</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
