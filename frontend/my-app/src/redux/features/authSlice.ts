import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import Cookies from 'js-cookie';

interface AuthState {
  isLoggedIn: boolean;
  user: {
    username: string;
    id?: number;
  } | null;
}

const demoUser = { username: 'Demo', id: 0 };

const initialState: AuthState = {
  isLoggedIn: true,
  user: Cookies.get('auth') ? JSON.parse(Cookies.get('auth') || '{}') : demoUser,
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
      state.isLoggedIn = true;
      state.user = demoUser;
      Cookies.remove('auth');
    },
  },
});

export const { login, logout } = authSlice.actions;
export default authSlice.reducer;
