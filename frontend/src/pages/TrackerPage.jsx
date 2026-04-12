import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiDelete } from '../api';
import DailySummary from '../components/DailySummary';
import MealSection from '../components/MealSection';

const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function TrackerPage() {
  const [date, setDate] = useState(localDateStr());
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

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
      meal_type: item.meal_type,
      logged_date: date,
    });
    fetchLogs();
  }

  async function handleDelete(logId) {
    await apiDelete(`/api/tracker/logs/${logId}`);
    fetchLogs();
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
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-umd-black">Macro Tracker</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const d = new Date(date + 'T12:00:00');
              d.setDate(d.getDate() - 1);
              setDate(localDateStr(d));
            }}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-umd-red"
          />
          <button
            onClick={() => {
              const d = new Date(date + 'T12:00:00');
              d.setDate(d.getDate() + 1);
              setDate(localDateStr(d));
            }}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          {date !== localDateStr() && (
            <button
              onClick={() => setDate(localDateStr())}
              className="text-xs text-umd-red font-semibold hover:underline ml-1"
            >
              Today
            </button>
          )}
        </div>
      </div>

      <DailySummary totals={totals} />

      {loading ? (
        <div className="text-center py-12 text-umd-gray-dark">Loading...</div>
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
