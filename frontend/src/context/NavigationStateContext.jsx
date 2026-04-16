import { createContext, useContext, useCallback, useState, useMemo } from 'react';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const defaultMenu = {
  date: null,
  activeHall: null,
  activeMeal: null,
  includeTags: [],
  excludeTags: [],
  legendOpen: false,
  showFavManager: false,
};

const defaultChat = {
  activeSession: null,
  messages: [],
  input: '',
  sidebarOpen: typeof window !== 'undefined' ? window.innerWidth >= 768 : true,
};

const defaultTracker = {
  date: null,
  showGoalEditor: false,
  dismissed: false,
};

const defaultRecipe = {
  activeSession: null,
  messages: [],
  showForm: true,
  followUp: '',
  cuisine: '',
  goals: [],
  hall: 'South Campus',
  meal: 'Lunch',
  dt: todayStr(),
  sidebarOpen: typeof window !== 'undefined' ? window.innerWidth >= 768 : true,
};

const NavigationStateContext = createContext(null);

export function NavigationStateProvider({ children }) {
  const [menu, setMenu] = useState(defaultMenu);
  const [chat, setChat] = useState(defaultChat);
  const [tracker, setTracker] = useState(defaultTracker);
  const [recipe, setRecipe] = useState(defaultRecipe);

  const patchMenu = useCallback((p) => setMenu((m) => ({ ...m, ...p })), []);
  const patchChat = useCallback((p) => setChat((c) => ({ ...c, ...p })), []);
  const patchTracker = useCallback((p) => setTracker((t) => ({ ...t, ...p })), []);
  const patchRecipe = useCallback((p) => setRecipe((r) => ({ ...r, ...p })), []);

  const value = useMemo(
    () => ({
      menu,
      patchMenu,
      chat,
      patchChat,
      tracker,
      patchTracker,
      recipe,
      patchRecipe,
    }),
    [menu, chat, tracker, recipe, patchMenu, patchChat, patchTracker, patchRecipe]
  );

  return (
    <NavigationStateContext.Provider value={value}>
      {children}
    </NavigationStateContext.Provider>
  );
}

export function useNavigationState() {
  const v = useContext(NavigationStateContext);
  if (!v) {
    throw new Error('useNavigationState must be used within NavigationStateProvider');
  }
  return v;
}
