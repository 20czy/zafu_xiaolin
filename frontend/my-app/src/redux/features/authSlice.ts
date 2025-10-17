import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import Cookies from 'js-cookie';

interface AuthState {
  isLoggedIn: boolean;
  user: {
    username: string;
    id?: number;
  } | null;
}

// Get initial state from cookies, but we'll validate it in ProtectedRoute
const initialState: AuthState = {
  isLoggedIn: !!Cookies.get('auth'),
  user: Cookies.get('auth') ? JSON.parse(Cookies.get('auth') || '{}') : null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    login: (state, action: PayloadAction<{ username: string; id: number }>) => {
      state.isLoggedIn = true;
      state.user = action.payload;
      // Set cookie with 7-day expiration
      Cookies.set('auth', JSON.stringify(action.payload), { expires: 7 });
    },
    logout: (state) => {
      state.isLoggedIn = false;
      state.user = null;
      // Remove cookie
      Cookies.remove('auth');
    },
  },
});

export const { login, logout } = authSlice.actions;
export default authSlice.reducer;