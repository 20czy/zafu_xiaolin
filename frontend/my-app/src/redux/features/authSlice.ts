import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import Cookies from 'js-cookie';

interface AuthState {
  isLoggedIn: boolean;
  user: {
    username: string;
    id?: number;
  } | null;
}

// 从 cookies 获取初始状态
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
      // 设置 cookie，7天过期
      Cookies.set('auth', JSON.stringify(action.payload), { expires: 7 });
    },
    logout: (state) => {
      state.isLoggedIn = false;
      state.user = null;
      // 移除 cookie
      Cookies.remove('auth');
    },
  },
});

export const { login, logout } = authSlice.actions;
export default authSlice.reducer;