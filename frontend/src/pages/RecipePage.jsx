import { useState, useRef, useEffect, useCallback } from 'react';
import { apiPost, apiGet, apiDelete } from '../api';
import ChatMessage from '../components/ChatMessage';

const HALLS = ['South Campus', 'Yahentamitsi Dining Hall', '251 North'];
const MEALS = ['Breakfast', 'Lunch', 'Dinner'];
const GOAL_OPTIONS = ['High Protein', 'Low Carb', 'Low Fat', 'Low Calorie', 'Vegan', 'Vegetarian', 'Halal'];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function RecipePage() {
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showForm, setShowForm] = useState(true);
  const [followUp, setFollowUp] = useState('');
  const bottomRef = useRef(null);

  const [cuisine, setCuisine] = useState('');
  const [goals, setGoals] = useState([]);
  const [hall, setHall] = useState(HALLS[0]);
  const [meal, setMeal] = useState(MEALS[1]);
  const [dt, setDt] = useState(todayStr());

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchSessions = useCallback(async () => {
    try {
      const data = await apiGet('/api/chat/sessions');
      setSessions(data.filter((s) => s.title.startsWith('Recipe:')));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  async function loadSession(id) {
    setActiveSession(id);
    setShowForm(false);
    try {
      const data = await apiGet(`/api/chat/sessions/${id}/messages`);
      const visible = (data.messages || []).filter((m) => m.role !== 'system');
      setMessages(visible);
    } catch {
      setMessages([]);
    }
  }

  function handleNewRecipe() {
    setActiveSession(null);
    setMessages([]);
    setShowForm(true);
    setCuisine('');
    setGoals([]);
  }

  async function handleDeleteSession(id) {
    await apiDelete(`/api/chat/sessions/${id}`);
    if (activeSession === id) handleNewRecipe();
    fetchSessions();
  }

  function toggleGoal(goal) {
    setGoals((prev) => prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]);
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (loading) return;

    const userSummary = `Craving: ${cuisine || 'anything'} | Goals: ${goals.join(', ') || 'none'} | ${hall}, ${meal}`;
    setMessages([{ role: 'user', content: userSummary }]);
    setShowForm(false);
    setLoading(true);

    try {
      const data = await apiPost('/api/recipe', {
        hall, meal, dt,
        cuisine: cuisine || 'anything',
        goals: goals.length > 0 ? goals : null,
      });
      setActiveSession(data.session_id);
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
      fetchSessions();
    } catch (err) {
      const msg = err.message?.includes('No menu data')
        ? `No menu data found for **${hall}** — **${meal}** on **${dt}**. Try a different date, meal, or dining hall.`
        : `Error: ${err.message}`;
      setMessages((prev) => [...prev, { role: 'assistant', content: msg }]);
      setShowForm(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleFollowUp(e) {
    e.preventDefault();
    const text = followUp.trim();
    if (!text || loading || !activeSession) return;

    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setFollowUp('');
    setLoading(true);

    try {
      const data = await apiPost('/api/recipe', {
        session_id: activeSession,
        message: text,
      });
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-200 bg-white border-r border-gray-200 flex flex-col overflow-hidden flex-shrink-0`}>
        <div className="p-3 border-b border-gray-100">
          <button onClick={handleNewRecipe}
            className="w-full bg-umd-red hover:bg-umd-red-dark text-white text-sm font-semibold py-2 rounded-lg transition-colors">
            + New Recipe
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessions.map((s) => (
            <div key={s.id}
              className={`group flex items-center gap-1 px-3 py-2.5 cursor-pointer text-sm border-b border-gray-50 transition-colors ${
                activeSession === s.id ? 'bg-red-50 text-umd-red' : 'text-umd-black hover:bg-gray-50'
              }`}>
              <button onClick={() => loadSession(s.id)} className="flex-1 text-left truncate">{s.title}</button>
              <button onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id); }}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 p-0.5 transition-opacity">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          {sessions.length === 0 && (
            <div className="p-4 text-xs text-umd-gray-dark text-center">No recipe history yet</div>
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-3 py-2 border-b border-gray-100 bg-white flex items-center gap-2">
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-umd-gray-dark">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-sm text-umd-gray-dark">
            {activeSession ? sessions.find((s) => s.id === activeSession)?.title || 'Recipe' : 'New Recipe'}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6">
          {showForm && messages.length === 0 && (
            <div className="max-w-lg mx-auto">
              <div className="text-center mb-6">
                <div className="text-4xl mb-3">🍳</div>
                <h2 className="text-xl font-bold text-umd-black mb-1">Recipe Creator</h2>
                <p className="text-sm text-umd-gray-dark">
                  Tell me what you're craving and I'll create recipes from today's dining hall ingredients.
                </p>
              </div>

              <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-umd-black mb-1">What are you craving?</label>
                  <input type="text" value={cuisine} onChange={(e) => setCuisine(e.target.value)}
                    placeholder="Asian, Mediterranean, comfort food, anything..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-umd-red focus:border-transparent" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-umd-black mb-1.5">Dietary goals</label>
                  <div className="flex flex-wrap gap-1.5">
                    {GOAL_OPTIONS.map((g) => (
                      <button key={g} type="button" onClick={() => toggleGoal(g)}
                        className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${
                          goals.includes(g)
                            ? 'bg-umd-red text-white border-umd-red'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-umd-red hover:text-umd-red'
                        }`}>{g}</button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-umd-black mb-1">Dining Hall</label>
                    <select value={hall} onChange={(e) => setHall(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-umd-red">
                      {HALLS.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-umd-black mb-1">Meal</label>
                    <select value={meal} onChange={(e) => setMeal(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-umd-red">
                      {MEALS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-umd-black mb-1">Date</label>
                  <input type="date" value={dt} onChange={(e) => setDt(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-umd-red" />
                </div>

                <button type="submit" disabled={loading}
                  className="w-full bg-umd-red hover:bg-umd-red-dark text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50">
                  {loading ? 'Creating recipes...' : 'Create Recipes'}
                </button>
              </form>
            </div>
          )}

          {messages.map((m, i) => (
            <ChatMessage key={i} role={m.role} content={m.content} />
          ))}

          {loading && (
            <div className="flex justify-start mb-3">
              <div className="bg-white shadow-sm border border-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-umd-gray-dark rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-umd-gray-dark rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-umd-gray-dark rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {!showForm && (
          <form onSubmit={handleFollowUp} className="border-t border-gray-200 bg-white px-4 py-3 flex gap-3">
            <input type="text" value={followUp} onChange={(e) => setFollowUp(e.target.value)}
              placeholder="Ask for modifications, different cuisine, dessert ideas..."
              className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-umd-red focus:border-transparent"
              disabled={loading} />
            <button type="submit" disabled={loading || !followUp.trim()}
              className="bg-umd-red hover:bg-umd-red-dark text-white font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-40">
              Send
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
