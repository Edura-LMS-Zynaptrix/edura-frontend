/**
 * A fresh Redux store per test, configured exactly like src/lib/redux/store.ts,
 * plus a render helper that wraps a component in it.
 */
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { render, type RenderOptions } from '@testing-library/react';
import { Provider } from 'react-redux';
import type { ReactElement, ReactNode } from 'react';
import authReducer from '@/lib/redux/slices/authSlice';
import uiReducer from '@/lib/redux/slices/uiSlice';
import coursesReducer from '@/lib/redux/slices/coursesSlice';
import examsReducer from '@/lib/redux/slices/examsSlice';
import questionsReducer from '@/lib/redux/slices/questionsSlice';
import studentDashboardReducer from '@/lib/redux/slices/studentDashboardSlice';
import adminReducer from '@/lib/redux/slices/adminSlice';
import paymentReducer from '@/lib/redux/slices/paymentSlice';
import referralReducer from '@/lib/redux/slices/referralSlice';
import badgesReducer from '@/lib/redux/slices/badgesSlice';
import videoClassesReducer from '@/lib/redux/slices/videoClassesSlice';
import chatReducer from '@/lib/redux/slices/chatSlice';
import feedbackReducer from '@/lib/redux/slices/feedbackSlice';
import { errorHandlingMiddleware } from '@/lib/redux/middleware';

const rootReducer = combineReducers({
  auth: authReducer,
  ui: uiReducer,
  courses: coursesReducer,
  exams: examsReducer,
  questions: questionsReducer,
  studentDashboard: studentDashboardReducer,
  admin: adminReducer,
  payment: paymentReducer,
  referral: referralReducer,
  badges: badgesReducer,
  videoClasses: videoClassesReducer,
  chat: chatReducer,
  feedback: feedbackReducer,
});

export type TestState = ReturnType<typeof rootReducer>;

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

/** Build a store; `preloaded` slices are merged over each slice's initial state. */
export function makeStore(preloaded: DeepPartial<TestState> = {}) {
  const initial = rootReducer(undefined, { type: '@@init' });
  const state = { ...initial } as any;
  for (const [key, value] of Object.entries(preloaded)) {
    state[key] = { ...(initial as any)[key], ...(value as object) };
  }
  return configureStore({
    reducer: rootReducer,
    preloadedState: state,
    middleware: (getDefault) =>
      getDefault({ serializableCheck: false }).concat(errorHandlingMiddleware),
  });
}

export type TestStore = ReturnType<typeof makeStore>;

/** Render inside a Provider; returns the store alongside the usual queries. */
export function renderWithStore(
  ui: ReactElement,
  {
    store = makeStore(),
    ...options
  }: { store?: TestStore } & Omit<RenderOptions, 'wrapper'> = {}
) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  return { store, ...render(ui, { wrapper: Wrapper, ...options }) };
}
