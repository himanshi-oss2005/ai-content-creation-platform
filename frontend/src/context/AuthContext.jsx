
import { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth';

const AuthContext = createContext(null);

const initialState = { user: null, loading: true };

function reducer(state, action) {
  switch (action.type) {
    case 'SET_USER':    return { ...state, user: action.payload, loading: false };
    case 'CLEAR_USER':  return { user: null, loading: false };
    case 'SET_LOADING': return { ...state, loading: action.payload };
    default:            return state;
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const navigate = useNavigate();
  const initRef = useRef(false); // Prevent duplicate requests in StrictMode

  // Restore session on mount — relies on httpOnly cookie set by backend
  // amazonq-ignore-next-line
  useEffect(() => {
    // Only run once - protect against React StrictMode double mount
    if (initRef.current) return;
    initRef.current = true;

    authApi.getMe()
      .then((user) => dispatch({ type: 'SET_USER', payload: user }))
      .catch(() => dispatch({ type: 'CLEAR_USER' }));
  }, []);

  const login = useCallback(async (email, password) => {
    // amazonq-ignore-next-line
    const data = await authApi.login(email, password);
    dispatch({ type: 'SET_USER', payload: data.user });
    navigate('/dashboard');
  }, [navigate]);

  const register = useCallback(async (name, email, password) => {
    // amazonq-ignore-next-line
    await authApi.register(name, email, password);
    navigate('/login', { state: { message: 'Account created! Please sign in.' } });
  }, [navigate]);

  const logout = useCallback(() => {
    dispatch({ type: 'CLEAR_USER' });
    navigate('/login');
  }, [navigate]);

  // amazonq-ignore-next-line
  const loginWithToken = useCallback(async () => {
    try {
      const user = await authApi.getMe();
      dispatch({ type: 'SET_USER', payload: user });
      navigate('/dashboard');
    } catch {
      navigate('/login?error=oauth');
    }
  }, [navigate]);

  // Called after generation to sync credit count without full reload
  const refreshUser = useCallback(async () => {
    try {
      const user = await authApi.getMe();
      dispatch({ type: 'SET_USER', payload: user });
    } catch { /* silent */ }
  }, []);

  return (
    // amazonq-ignore-next-line
    <AuthContext.Provider value={{ ...state, login, register, logout, refreshUser, loginWithToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
