import { useState, useRef, useEffect } from 'react';
import { apiGet } from '../api';

const SERVING_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5];

export default function FoodSearch({ mealType, onLog }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [servings, setServings] = useState(1);
  const [showResults, setShowResults] = useState(false);
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowResults(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleQueryChange(val) {
    setQuery(val);
    setSelected(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await apiGet(`/api/nutrition/search?q=${encodeURIComponent(val)}`);
        setResults(data.results || []);
        setShowResults(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }

  function selectItem(item) {
    setSelected(item);
    setQuery(item.name);
    setShowResults(false);
    setServings(1);
  }

  function handleLog() {
    if (!selected) return;
    onLog({
      food_item_id: selected.food_item_id,
      food_name: selected.name,
      servings,
      meal_type: mealType,
      calories: selected.calories,
      protein_g: selected.protein_g,
      total_fat_g: selected.total_fat_g,
      total_carbs_g: selected.total_carbs_g,
    });
    setQuery('');
    setSelected(null);
    setServings(1);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => results.length > 0 && setShowResults(true)}
            placeholder="Search dining hall food..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-umd-red focus:border-transparent"
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-umd-red border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {showResults && results.length > 0 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {results.map((item, i) => (
                <button
                  key={i}
                  onClick={() => selectItem(item)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-umd-gray transition-colors border-b border-gray-50 last:border-b-0"
                >
                  <div className="font-medium text-umd-black">{item.name}</div>
                  <div className="text-xs text-umd-gray-dark mt-0.5">
                    {item.calories || 0} cal · {item.protein_g || 0}g protein · {item.total_fat_g || 0}g fat · {item.total_carbs_g || 0}g carbs
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {selected && (
          <>
            <select
              value={servings}
              onChange={(e) => setServings(parseFloat(e.target.value))}
              className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-umd-red w-24"
            >
              {SERVING_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s} {s === 1 ? 'serving' : 'servings'}
                </option>
              ))}
            </select>
            <button
              onClick={handleLog}
              className="bg-umd-red hover:bg-umd-red-dark text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
            >
              + Log
            </button>
          </>
        )}
      </div>

      {selected && (
        <div className="mt-2 bg-umd-gray rounded-lg px-3 py-2 text-xs text-umd-gray-dark">
          Per {servings} serving{servings !== 1 ? 's' : ''}:{' '}
          <span className="font-semibold text-umd-black">
            {Math.round((selected.calories || 0) * servings)} cal
          </span>
          {' · '}{Math.round((selected.protein_g || 0) * servings * 10) / 10}g P
          {' · '}{Math.round((selected.total_fat_g || 0) * servings * 10) / 10}g F
          {' · '}{Math.round((selected.total_carbs_g || 0) * servings * 10) / 10}g C
        </div>
      )}
    </div>
  );
}
