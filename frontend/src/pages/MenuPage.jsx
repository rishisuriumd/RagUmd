import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiGet } from '../api';

const MEAL_ORDER = ['Breakfast', 'Lunch', 'Dinner'];

const INCLUDE_TAGS = ['vegan', 'vegetarian', 'HalalFriendly'];
const EXCLUDE_TAGS = [
  'Contains dairy', 'Contains egg', 'Contains gluten', 'Contains nuts',
  'Contains sesame', 'Contains soy', 'Contains fish', 'Contains Shellfish',
];

const ALL_BADGES = {
  'Contains dairy':     { letter: 'D',  hex: '#3978b1', label: 'Dairy' },
  'Contains egg':       { letter: 'E',  hex: '#e6ba3a', label: 'Eggs' },
  'Contains fish':      { letter: 'F',  hex: '#e33980', label: 'Fish' },
  'Contains gluten':    { letter: 'G',  hex: '#e56644', label: 'Gluten' },
  'Contains nuts':      { letter: 'N',  hex: '#df363c', label: 'Nuts' },
  'Contains sesame':    { letter: 'SS', hex: '#ea9f42', label: 'Sesame' },
  'Contains Shellfish': { letter: 'SF', hex: '#4db8ad', label: 'Shellfish' },
  'Contains soy':       { letter: 'S',  hex: '#9fcb63', label: 'Soy' },
  'HalalFriendly':      { letter: 'HF', hex: '#47b3de', label: 'Halal Friendly' },
  'vegan':              { letter: 'VG', hex: '#986aab', label: 'Vegan' },
  'vegetarian':         { letter: 'V',  hex: '#458361', label: 'Vegetarian' },
};

function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function BadgeCircle({ tag, size = 'sm' }) {
  const b = ALL_BADGES[tag];
  if (!b) return null;
  const cls = size === 'lg'
    ? 'w-6 h-6 text-[10px]'
    : 'w-5 h-5 text-[9px]';
  return (
    <span title={b.label}
      className={`${cls} rounded-full text-white font-bold flex items-center justify-center shrink-0`}
      style={{ backgroundColor: b.hex }}>
      {b.letter}
    </span>
  );
}

function ItemBadges({ tags }) {
  const matching = tags.filter((t) => ALL_BADGES[t]);
  if (matching.length === 0) return null;
  return (
    <div className="flex gap-1 flex-wrap justify-end">
      {matching.map((t) => <BadgeCircle key={t} tag={t} />)}
    </div>
  );
}

function LegendPanel({ open, onClose }) {
  if (!open) return null;

  const dietary = Object.entries(ALL_BADGES).filter(([k]) => INCLUDE_TAGS.includes(k));
  const allergens = Object.entries(ALL_BADGES).filter(([k]) => !INCLUDE_TAGS.includes(k));

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-full mt-2 z-50 w-64 umd-card rounded-xl p-4 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold text-umd-black">Icon Legend</span>
          <button onClick={onClose} className="text-umd-gray-dark hover:text-umd-black p-0.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="text-[11px] font-semibold text-umd-gray-dark uppercase tracking-wide mb-2">Allergens</div>
        <div className="space-y-2 mb-4">
          {allergens.map(([key]) => (
            <div key={key} className="flex items-center gap-2.5">
              <BadgeCircle tag={key} size="lg" />
              <span className="text-sm text-umd-body">{ALL_BADGES[key].label}</span>
            </div>
          ))}
        </div>

        <div className="text-[11px] font-semibold text-umd-gray-dark uppercase tracking-wide mb-2">Dietary</div>
        <div className="space-y-2">
          {dietary.map(([key]) => (
            <div key={key} className="flex items-center gap-2.5">
              <BadgeCircle tag={key} size="lg" />
              <span className="text-sm text-umd-body">{ALL_BADGES[key].label}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function ItemRow({ item }) {
  return (
    <div className="px-4 py-1.5 flex items-center justify-between">
      <span className="text-sm text-umd-black">{item.name}</span>
      <ItemBadges tags={item.tags} />
    </div>
  );
}

function StationGroup({ station, items }) {
  const [open, setOpen] = useState(true);
  const sorted = useMemo(() => [...items].sort((a, b) => a.name.localeCompare(b.name)), [items]);

  return (
    <div className="border border-umd-gray rounded-lg overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-umd-gray-light hover:bg-umd-gray transition-colors">
        <span className="font-semibold text-sm text-umd-black">{station}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-umd-body">{items.length} items</span>
          <svg className={`w-3.5 h-3.5 text-umd-gray-dark transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {open && (
        <div className="divide-y divide-umd-gray-light">
          {sorted.map((item, i) => <ItemRow key={i} item={item} />)}
        </div>
      )}
    </div>
  );
}

function FilterBar({ includeTags, excludeTags, onToggleInclude, onToggleExclude, onClear }) {
  const hasActive = includeTags.length > 0 || excludeTags.length > 0;

  return (
    <div className="umd-card rounded-xl px-4 py-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-umd-gray-dark uppercase tracking-wide">Filters</span>
        {hasActive && <button onClick={onClear} className="text-xs text-umd-red hover:underline">Clear all</button>}
      </div>
      <div className="space-y-1.5">
        <div className="text-[11px] text-umd-body font-medium">Show only:</div>
        <div className="flex flex-wrap gap-1.5">
          {INCLUDE_TAGS.map((tag) => {
            const active = includeTags.includes(tag);
            const badge = ALL_BADGES[tag];
            return (
              <button key={tag} onClick={() => onToggleInclude(tag)}
                className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-colors flex items-center gap-1.5 ${
                  active ? 'bg-green-50 text-green-700 border-green-300' : 'bg-white text-umd-body border-umd-gray hover:border-umd-gray-dark'
                }`}>
                {badge && <span className="w-3.5 h-3.5 rounded-full text-white text-[7px] font-bold inline-flex items-center justify-center" style={{ backgroundColor: badge.hex }}>{badge.letter}</span>}
                {badge.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="text-[11px] text-umd-body font-medium">Exclude allergens:</div>
        <div className="flex flex-wrap gap-1.5">
          {EXCLUDE_TAGS.map((tag) => {
            const active = excludeTags.includes(tag);
            const badge = ALL_BADGES[tag];
            return (
              <button key={tag} onClick={() => onToggleExclude(tag)}
                className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-colors flex items-center gap-1.5 ${
                  active ? 'bg-red-100 text-red-700 border-red-300' : 'bg-white text-umd-body border-umd-gray hover:border-umd-gray-dark'
                }`}>
                {badge && <span className="w-3.5 h-3.5 rounded-full text-white text-[7px] font-bold inline-flex items-center justify-center" style={{ backgroundColor: badge.hex }}>{badge.letter}</span>}
                {badge.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function MenuPage() {
  const today = localDateStr();
  const [date, setDate] = useState(today);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeHall, setActiveHall] = useState(null);
  const [activeMeal, setActiveMeal] = useState(null);
  const [includeTags, setIncludeTags] = useState([]);
  const [excludeTags, setExcludeTags] = useState([]);
  const [legendOpen, setLegendOpen] = useState(false);

  const fetchMenu = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await apiGet(`/api/menu/browse?dt=${date}`);
      setData(resp);
    } catch { setData(null); }
    finally { setLoading(false); }
  }, [date]);

  useEffect(() => { fetchMenu(); }, [fetchMenu]);

  useEffect(() => {
    if (data && activeHall && data.halls[activeHall]) {
      const meals = Object.keys(data.halls[activeHall]);
      const ordered = MEAL_ORDER.filter((m) => meals.includes(m));
      if (!activeMeal || !ordered.includes(activeMeal)) setActiveMeal(ordered[0] || null);
    }
  }, [activeHall, data]);

  function toggleInclude(tag) { setIncludeTags((p) => p.includes(tag) ? p.filter((t) => t !== tag) : [...p, tag]); }
  function toggleExclude(tag) { setExcludeTags((p) => p.includes(tag) ? p.filter((t) => t !== tag) : [...p, tag]); }

  const filteredStations = useMemo(() => {
    if (!data || !activeHall || !activeMeal) return {};
    const raw = data.halls[activeHall]?.[activeMeal] || {};
    if (includeTags.length === 0 && excludeTags.length === 0) return raw;
    const result = {};
    for (const [station, items] of Object.entries(raw)) {
      const filtered = items.filter((item) => {
        if (includeTags.length > 0 && !includeTags.every((t) => item.tags.includes(t))) return false;
        if (excludeTags.length > 0 && excludeTags.some((t) => item.tags.includes(t))) return false;
        return true;
      });
      if (filtered.length > 0) result[station] = filtered;
    }
    return result;
  }, [data, activeHall, activeMeal, includeTags, excludeTags]);

  const filteredCount = Object.values(filteredStations).reduce((s, items) => s + items.length, 0);
  const halls = data ? Object.keys(data.halls).sort() : [];
  const meals = data && activeHall && data.halls[activeHall]
    ? MEAL_ORDER.filter((m) => Object.keys(data.halls[activeHall]).includes(m)) : [];

  return (
    <div className="umd-container px-4 py-6 space-y-5">
      {loading ? (
        <div className="text-center py-16 text-umd-body">Loading menu...</div>
      ) : !data || halls.length === 0 ? (
        <div className="text-center py-16 text-umd-body">No menu data available for this date.</div>
      ) : !activeHall ? (
        <div className="flex flex-col items-center py-16">
          <div className="text-5xl mb-4">🐢</div>
          <h1 className="text-4xl umd-hero-title text-umd-black mb-2">Today's Menu</h1>
          <p className="text-umd-body text-sm mb-8">Pick a dining hall to see what's cooking</p>
          <div className="flex flex-wrap gap-3 justify-center">
            {halls.map((h) => (
              <button key={h} onClick={() => setActiveHall(h)}
                className="px-6 py-4 rounded-xl text-base font-bold umd-card hover:border-umd-red hover:text-umd-red transition-colors">
                {h}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h1 className="text-2xl sm:text-4xl umd-hero-title text-umd-black">Today's Menu</h1>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => {
                  const d = new Date(date + 'T12:00:00');
                  d.setDate(d.getDate() - 1);
                  const prev = localDateStr(d);
                  if (prev >= today) setDate(prev);
                }}
                disabled={date <= today}
                className={`p-1.5 sm:p-2 rounded-lg transition-colors ${date <= today ? 'opacity-30 cursor-not-allowed' : 'hover:bg-umd-gray-light'}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <input type="date" value={date} min={today}
                onChange={(e) => { const v = e.target.value; setDate(v < today ? today : v); }}
                className="border border-umd-gray rounded-lg px-2 sm:px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-umd-red" />
              <button onClick={() => { const d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() + 1); setDate(localDateStr(d)); }}
                className="p-1.5 sm:p-2 hover:bg-umd-gray-light rounded-lg transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
              {date !== today && (
                <button onClick={() => setDate(today)} className="text-xs text-umd-red font-semibold hover:underline ml-1">Today</button>
              )}

              {/* legend */}
              <div className="relative ml-1">
                <button
                  onClick={() => setLegendOpen(!legendOpen)}
                  className={`p-1.5 sm:p-2 rounded-lg border transition-colors ${legendOpen ? 'bg-umd-red text-white border-umd-red' : 'border-umd-gray text-umd-gray-dark hover:border-umd-red hover:text-umd-red'}`}
                  title="Icon legend"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
                <LegendPanel open={legendOpen} onClose={() => setLegendOpen(false)} />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {halls.map((h) => (
              <button key={h} onClick={() => setActiveHall(h)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  activeHall === h ? 'bg-umd-red text-white' : 'bg-white text-umd-black border border-umd-gray hover:border-umd-red hover:text-umd-red'
                }`}>{h}</button>
            ))}
          </div>

          {meals.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {meals.map((m) => (
                <button key={m} onClick={() => setActiveMeal(m)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    activeMeal === m ? 'bg-umd-gold text-umd-black' : 'bg-umd-gray-light text-umd-body hover:bg-umd-gray'
                  }`}>{m}</button>
              ))}
            </div>
          )}

          <FilterBar includeTags={includeTags} excludeTags={excludeTags}
            onToggleInclude={toggleInclude} onToggleExclude={toggleExclude}
            onClear={() => { setIncludeTags([]); setExcludeTags([]); }} />

          {(includeTags.length > 0 || excludeTags.length > 0) && (
            <div className="text-xs text-umd-body">
              Showing <span className="font-semibold text-umd-black">{filteredCount}</span> items matching filters
            </div>
          )}

          {Object.keys(filteredStations).length > 0 ? (
            <div className="space-y-2">
              {Object.keys(filteredStations).sort().map((station) => (
                <StationGroup key={station} station={station} items={filteredStations[station]} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-umd-body text-sm">No items match the current filters.</div>
          )}
        </>
      )}
    </div>
  );
}
