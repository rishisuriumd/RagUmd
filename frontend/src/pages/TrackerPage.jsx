import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiDelete } from '../api';
import DailySummary from '../components/DailySummary';
import MealSection from '../components/MealSection';

const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function TrackerPage() {
  const today = localDateStr();
  const [date, setDate] = useState(today);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const isToday = date === today;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet(`/api/tracker/logs?date=${date}`);
      setLogs(data.logs || []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  async function handleLog(item) {
    if (!item.food_item_id) return;
    await apiPost('/api/tracker/logs', {
      food_item_id: item.food_item_id,
      servings: item.servings,
      portion_label: item.portion_label || null,
      meal_type: item.meal_type,
      logged_date: date,
    });
    fetchLogs();
  }

  async function handleDelete(logId) {
    await apiDelete(`/api/tracker/logs/${logId}`);
    fetchLogs();
  }

  function goBack() {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    setDate(localDateStr(d));
  }

  function goForward() {
    if (isToday) return;
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    const next = localDateStr(d);
    setDate(next > today ? today : next);
  }

  const totals = logs.reduce(
    (acc, l) => ({
      calories: acc.calories + (l.calories || 0),
      protein_g: acc.protein_g + (l.protein_g || 0),
      total_fat_g: acc.total_fat_g + (l.total_fat_g || 0),
      total_carbs_g: acc.total_carbs_g + (l.total_carbs_g || 0),
    }),
    { calories: 0, protein_g: 0, total_fat_g: 0, total_carbs_g: 0 }
  );

  return (
    <div className="umd-container max-w-3xl px-4 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl umd-hero-title text-umd-black">Macro Tracker</h1>
        <div className="flex items-center gap-2">
          <button onClick={goBack} className="p-2 hover:bg-umd-gray-light rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => {
              const v = e.target.value;
              setDate(v > today ? today : v);
            }}
            className="border border-umd-gray rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-umd-red"
          />
          <button
            onClick={goForward}
            disabled={isToday}
            className={`p-2 rounded-lg transition-colors ${isToday ? 'opacity-30 cursor-not-allowed' : 'hover:bg-umd-gray-light'}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          {!isToday && (
            <button onClick={() => setDate(today)} className="text-xs text-umd-red font-semibold hover:underline ml-1">
              Today
            </button>
          )}
        </div>
      </div>

      <DailySummary totals={totals} />

      {loading ? (
        <div className="text-center py-12 text-umd-body">Loading...</div>
      ) : (
        MEALS.map((meal) => (
          <MealSection
            key={meal}
            title={meal}
            logs={logs.filter((l) => l.meal_type === meal)}
            onLog={handleLog}
            onDelete={handleDelete}
          />
        ))
      )}
    </div>
  );
}
