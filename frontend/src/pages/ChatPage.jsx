import { useState, useRef, useEffect, useCallback } from 'react';
import { apiPost, apiGet, apiDelete } from '../api';
import ChatMessage from '../components/ChatMessage';

export default function ChatPage() {
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchSessions = useCallback(async () => {
    try {
      const data = await apiGet('/api/chat/sessions');
      setSessions(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  async function loadSession(id) {
    setActiveSession(id);
    try {
      const data = await apiGet(`/api/chat/sessions/${id}/messages`);
      setMessages(data.messages || []);
    } catch {
      setMessages([]);
    }
  }

  function handleNewChat() {
    setActiveSession(null);
    setMessages([]);
  }

  async function handleDeleteSession(id) {
    await apiDelete(`/api/chat/sessions/${id}`);
    if (activeSession === id) {
      setActiveSession(null);
      setMessages([]);
    }
    fetchSessions();
  }

  async function handleSend(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const data = await apiPost('/api/chat', {
        session_id: activeSession,
        message: text,
      });
      setActiveSession(data.session_id);
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
      fetchSessions();
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-5.5rem)] relative">
      {/* backdrop */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/30 z-20"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* sidebar */}
      <div className={`
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        ${sidebarOpen ? 'md:w-64' : 'md:w-0'}
        fixed md:relative z-30 md:z-auto
        h-[calc(100vh-5.5rem)] w-72 md:w-64
        transition-all duration-200
        bg-white border-r border-umd-gray
        flex flex-col overflow-hidden flex-shrink-0
      `}>
        <div className="p-3 border-b border-umd-gray">
          <button
            onClick={handleNewChat}
            className="w-full bg-umd-red hover:bg-umd-red-dark text-white text-sm font-semibold py-2 rounded-lg transition-colors"
          >
            + New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessions.map((s) => (
            <div
              key={s.id}
              className={`group flex items-center gap-1 px-3 py-2.5 cursor-pointer text-sm border-b border-umd-gray-light transition-colors ${
                activeSession === s.id ? 'bg-red-50 text-umd-red' : 'text-umd-black hover:bg-umd-gray-light'
              }`}
            >
              <button
                onClick={() => loadSession(s.id)}
                className="flex-1 text-left truncate"
              >
                {s.title}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id); }}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 p-0.5 transition-opacity"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          {sessions.length === 0 && (
            <div className="p-4 text-xs text-umd-body text-center">No chat history yet</div>
          )}
        </div>
      </div>

      {/* chat */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-3 py-2 border-b border-umd-gray bg-white flex items-center gap-2">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 hover:bg-umd-gray-light rounded-lg transition-colors text-umd-gray-dark"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-sm text-umd-body">
            {activeSession ? sessions.find((s) => s.id === activeSession)?.title || 'Chat' : 'New Chat'}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-5xl mb-4">🐢</div>
              <h2 className="text-xl font-bold text-umd-black mb-2">TerpDining Assistant</h2>
              <p className="text-umd-body text-sm max-w-sm">
                Ask me about dining hall menus, nutrition facts, allergens, dining plans, and more.
              </p>
              <div className="mt-6 flex flex-wrap gap-2 justify-center">
                {[
                  "What's for lunch at the Y today?",
                  "Any vegan options at 251 North?",
                  "Nutrition facts for pancakes",
                  "What dining plans are available?",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    className="text-xs bg-white border border-umd-gray rounded-full px-3 py-1.5 text-umd-body hover:border-umd-red hover:text-umd-red transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <ChatMessage key={i} role={m.role} content={m.content} />
          ))}

          {loading && (
            <div className="flex justify-start mb-3">
              <div className="w-8 h-8 rounded-full bg-umd-gold flex items-center justify-center text-base mr-2 mt-1 shrink-0">
                🐢
              </div>
              <div className="umd-card rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-umd-body rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-umd-body rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-umd-body rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSend} className="border-t border-umd-gray bg-white px-3 py-3 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about dining halls, menus, nutrition..."
            className="flex-1 min-w-0 border border-umd-gray rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-umd-red focus:border-transparent"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-umd-red hover:bg-umd-red-dark text-white font-semibold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-40 shrink-0"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
