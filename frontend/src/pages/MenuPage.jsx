import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiGet } from '../api';

const MEAL_ORDER = ['Breakfast', 'Lunch', 'Dinner'];

const INCLUDE_TAGS = ['vegan', 'vegetarian', 'HalalFriendly'];
const EXCLUDE_TAGS = [
  'Contains dairy', 'Contains egg', 'Contains gluten', 'Contains nuts',
  'Contains sesame', 'Contains soy', 'Contains fish', 'Contains Shellfish',
];

const TAG_STYLES = {
  vegan: 'bg-green-100 text-green-700 border-green-300',
  vegetarian: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  HalalFriendly: 'bg-blue-100 text-blue-700 border-blue-300',
};

// ── Item categorization ──────────────────────────────────────────────
// Each rule: [groupLabel, testFn]. First match wins. Order matters.
const GROUP_RULES = [
  ['Fruits', (n) => /\b(apple|banana|cantaloupe|grape(?!fruit)|orange|pineapple|watermelon|blueberr|strawberr|peach|pear|mango|honeydew|kiwi|plum|cherry|cherries|raspberry|raspberries|blackberr|cranberr|fig|apricot|nectarine|papaya|guava|lychee|passion\s?fruit|dragonfruit|tangerine|clementine|pomegranate|coconut|melon|fruit\b|fresh blueberry|fresh strawberry|fried banana)/i.test(n) && !/sauce|chutney|dressing|vinaigrette|syrup|cream/i.test(n)],
  ['Yogurt', (n) => /yogurt|parfait/i.test(n)],
  ['Cereal & Oatmeal', (n) => /\b(cereal|oatmeal|grits|granola|coco puff|special k|rice chex|cheerio|froot loop|frosted flake|lucky charm|honey bunch|cap.?n.?crunch|life cereal|raisin bran|corn flake|wheat chex|kix|chex mix)\b/i.test(n)],
  ['Eggs', (n) => /\b(egg|omelet|omelette|frittata|quiche)\b/i.test(n) && !/eggplant|egg roll/i.test(n)],
  ['Dressings & Vinaigrettes', (n) => /dressing|vinaigrette|vinegar/i.test(n)],
  ['Sauces & Condiments', (n) => /\b(bbq|mustard|mayonnaise|mayo|ketchup|sriracha|hot sauce|soy sauce|chutney|pesto|salsa|pico|guacamole|hummus|cream cheese|olive oil|chili oil|stir fry sauce|general tso|orange sauce|sweet sour|teriyaki|plum sauce|tahini|tzatziki|aioli|relish|hoisin|fish sauce|worcestershire|tabasco|ranch dip|baba ghanoush)\b/i.test(n) || /sauce$/i.test(n)],
  ['Syrups & Toppings', (n) => /syrup|topping|whipped cream|chocolate chip|sprinkle|m&m|oreo|maraschino|waffle cone|gummy|marshmallow/i.test(n)],
  ['Breads & Baked Goods', (n) => /\b(bagel|bread|roll|bun|muffin|donut|doughnut|croissant|biscuit|cornbread|naan|pita|tortilla|crouton|wonton strip|waffle|pancake|french toast|toast|flatbread|ciabatta|focaccia|scone|pretzel|english muffin)\b/i.test(n) && !/french fries/i.test(n)],
  ['Butter & Spreads', (n) => /^(butter|margarine|earth balance|sunbutter|jam |jelly|preserv|nutella|peanut butter|almond butter|honey$)/i.test(n)],
  ['Cheese', (n) => /cheese/i.test(n) && !/cheesesteak|cheesecake|cheeseburger/i.test(n)],
  ['Salad Greens', (n) => /^(arugula|chopped romaine|chopped lettuce|chopped kale|mixed green|spinach|shredded.*cabbage|leaf lettuce|shredded lettuce|romaine|iceberg|mesclun|spring mix|baby spinach|watercress|endive|radicchio)s?$/i.test(n)],
  ['Vegetables', (n) => /\b(broccoli|carrot|celery|cucumber|tomato|pepper|onion|olive|mushroom|corn\b|peas\b|bean sprout|edamame|cabbage|zucchini|squash|cauliflower|beet|artichoke|potato|sweet potato|green bean|brussel|asparagus|eggplant|parsnip|shishito|snap pea|water chestnut|roasted red pepper|kimchi|radish|turnip|bok choy|collard|okra|fennel|leek|scallion|jicama|chive|kale(?!.*chip)|chard|rutabaga|yam|plantain)\b/i.test(n) && !/french fri|hash brown|mashed potato|scalloped|potato chip|potato roll|potato hamburger|potato hot dog/i.test(n)],
  ['Nuts, Seeds & Toppings', (n) => /\b(seed|nut\b|raisin|bacon bit|corn nut|flax|almond(?!.*milk)|walnut|pecan|cashew|pistachio|macadamia|hazelnut|pine nut|pepita|chia\b)\b/i.test(n) && !/butternut|coconut|donut|doughnut/i.test(n)],
  ['Rice & Grains', (n) => /\b(rice|quinoa|couscous|millet|farro|barley|bulgur|polenta|grits)\b/i.test(n) && !/rice chex|rice krispie/i.test(n)],
  ['Pasta & Noodles', (n) => /\b(pasta|noodle|linguini|linguine|rotini|gnocchi|lo mein|chow mein|spaghetti|penne|macaroni|fettuccin|rigatoni|orzo|tortellini|ravioli|ziti|farfalle|fusilli|cavatappi|udon|ramen|soba|pad thai|vermicelli|angel hair)\b/i.test(n)],
  ['Ice Cream & Desserts', (n) => /\b(ice cream|soft serve|cobbler|brownie|cake|cookie|pie|pudding|gelato|sorbet|frozen yogurt|mousse|tiramisu|cannoli|eclair|macaron|tart|cheesecake|cupcake|danish|strudel|flan|creme brulee)\b/i.test(n)],
  ['Chips & Fries', (n) => /\b(chip|fries|fry|hash brown|tater tot|onion ring)\b/i.test(n) && !/chipotle/i.test(n)],
  ['Beverages', (n) => /\b(juice|milk|lemonade|tea\b|coffee|water\b|soda|smoothie|shake|cider|kombucha|latte|cappuccino|espresso|hot chocolate|cocoa)\b/i.test(n)],
];

function categorizeItems(items) {
  const groups = {};
  const ungrouped = [];

  for (const item of items) {
    let placed = false;
    for (const [label, test] of GROUP_RULES) {
      if (test(item.name)) {
        if (!groups[label]) groups[label] = [];
        groups[label].push(item);
        placed = true;
        break;
      }
    }
    if (!placed) ungrouped.push(item);
  }

  // Only create a group if it has 2+ items; otherwise push to ungrouped
  const finalGroups = {};
  for (const [label, grpItems] of Object.entries(groups)) {
    if (grpItems.length >= 2) {
      finalGroups[label] = grpItems;
    } else {
      ungrouped.push(...grpItems);
    }
  }

  ungrouped.sort((a, b) => a.name.localeCompare(b.name));
  return { groups: finalGroups, ungrouped };
}

// ── Components ───────────────────────────────────────────────────────

function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function TagBadges({ tags }) {
  return (
    <div className="flex gap-1 flex-wrap justify-end">
      {tags.filter((t) => INCLUDE_TAGS.includes(t)).map((t) => (
        <span key={t} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${TAG_STYLES[t] || ''}`}>{t}</span>
      ))}
    </div>
  );
}

function ItemRow({ item }) {
  return (
    <div className="px-4 py-1.5 flex items-center justify-between">
      <span className="text-sm text-umd-black">{item.name}</span>
      <TagBadges tags={item.tags} />
    </div>
  );
}

function SubGroup({ label, items }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="ml-3 border-l-2 border-gray-200">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-2">
          <svg className={`w-3 h-3 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-xs font-semibold text-umd-gray-dark">{label}</span>
        </div>
        <span className="text-[10px] text-umd-gray-dark bg-gray-100 px-1.5 py-0.5 rounded-full">{items.length}</span>
      </button>
      {open && (
        <div className="divide-y divide-gray-50">
          {items.sort((a, b) => a.name.localeCompare(b.name)).map((item, i) => (
            <ItemRow key={i} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function StationGroup({ station, items }) {
  const [open, setOpen] = useState(true);
  const { groups, ungrouped } = useMemo(() => categorizeItems(items), [items]);
  const groupKeys = Object.keys(groups).sort();
  const hasSubGroups = groupKeys.length > 0;

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors">
        <span className="font-semibold text-sm text-umd-black">{station}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-umd-gray-dark">{items.length} items</span>
          <svg className={`w-3.5 h-3.5 text-umd-gray-dark transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {open && (
        <div>
          {/* Main items (not grouped) */}
          {ungrouped.length > 0 && (
            <div className="divide-y divide-gray-50">
              {ungrouped.map((item, i) => <ItemRow key={i} item={item} />)}
            </div>
          )}
          {/* Collapsed sub-groups */}
          {hasSubGroups && (
            <div className="py-1 space-y-0.5">
              {groupKeys.map((label) => (
                <SubGroup key={label} label={label} items={groups[label]} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FilterBar({ includeTags, excludeTags, onToggleInclude, onToggleExclude, onClear }) {
  const hasActive = includeTags.length > 0 || excludeTags.length > 0;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-umd-gray-dark uppercase tracking-wide">Filters</span>
        {hasActive && <button onClick={onClear} className="text-xs text-umd-red hover:underline">Clear all</button>}
      </div>
      <div className="space-y-1.5">
        <div className="text-[11px] text-umd-gray-dark font-medium">Show only:</div>
        <div className="flex flex-wrap gap-1.5">
          {INCLUDE_TAGS.map((tag) => {
            const active = includeTags.includes(tag);
            return (
              <button key={tag} onClick={() => onToggleInclude(tag)}
                className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-colors ${
                  active ? TAG_STYLES[tag] + ' border-current' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                }`}>{tag}</button>
            );
          })}
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="text-[11px] text-umd-gray-dark font-medium">Exclude allergens:</div>
        <div className="flex flex-wrap gap-1.5">
          {EXCLUDE_TAGS.map((tag) => {
            const active = excludeTags.includes(tag);
            return (
              <button key={tag} onClick={() => onToggleExclude(tag)}
                className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-colors ${
                  active ? 'bg-red-100 text-red-700 border-red-300' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                }`}>{tag.replace('Contains ', '')}</button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────

export default function MenuPage() {
  const [date, setDate] = useState(localDateStr());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeHall, setActiveHall] = useState(null);
  const [activeMeal, setActiveMeal] = useState(null);
  const [includeTags, setIncludeTags] = useState([]);
  const [excludeTags, setExcludeTags] = useState([]);

  const fetchMenu = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await apiGet(`/api/menu/browse?dt=${date}`);
      setData(resp);
      const halls = Object.keys(resp.halls || {});
      if (halls.length > 0 && !activeHall) setActiveHall(halls[0]);
      const firstHall = activeHall || halls[0];
      if (firstHall && resp.halls[firstHall]) {
        const meals = Object.keys(resp.halls[firstHall]);
        const ordered = MEAL_ORDER.filter((m) => meals.includes(m));
        if (ordered.length > 0 && !activeMeal) setActiveMeal(ordered[0]);
      }
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
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-umd-black">Today's Menu</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => { const d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() - 1); setDate(localDateStr(d)); }}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-umd-red" />
          <button onClick={() => { const d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() + 1); setDate(localDateStr(d)); }}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
          {date !== localDateStr() && (
            <button onClick={() => setDate(localDateStr())} className="text-xs text-umd-red font-semibold hover:underline ml-1">Today</button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-umd-gray-dark">Loading menu...</div>
      ) : !data || halls.length === 0 ? (
        <div className="text-center py-16 text-umd-gray-dark">No menu data available for this date.</div>
      ) : (
        <>
          <div className="flex gap-2">
            {halls.map((h) => (
              <button key={h} onClick={() => setActiveHall(h)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  activeHall === h ? 'bg-umd-red text-white' : 'bg-white text-umd-black border border-gray-200 hover:border-umd-red hover:text-umd-red'
                }`}>{h}</button>
            ))}
          </div>

          {meals.length > 0 && (
            <div className="flex gap-2">
              {meals.map((m) => (
                <button key={m} onClick={() => setActiveMeal(m)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    activeMeal === m ? 'bg-umd-gold text-umd-black' : 'bg-gray-100 text-umd-gray-dark hover:bg-gray-200'
                  }`}>{m}</button>
              ))}
            </div>
          )}

          <FilterBar includeTags={includeTags} excludeTags={excludeTags}
            onToggleInclude={toggleInclude} onToggleExclude={toggleExclude}
            onClear={() => { setIncludeTags([]); setExcludeTags([]); }} />

          {(includeTags.length > 0 || excludeTags.length > 0) && (
            <div className="text-xs text-umd-gray-dark">
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
            <div className="text-center py-8 text-umd-gray-dark text-sm">No items match the current filters.</div>
          )}
        </>
      )}
    </div>
  );
}
