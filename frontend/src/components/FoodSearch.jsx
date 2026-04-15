import { useState, useRef, useEffect, useMemo } from 'react';
import { apiGet } from '../api';

const SERVING_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5];

const PORTION_TYPES = [
  {
    id: 'spoonful', label: 'Spoonful', icon: '🥄', multiplier: 0.33,
    match: /soup|chili|stew|sauce|salsa|hummus|guacamole|dip|spread|butter|jam|jelly|oatmeal|yogurt|pudding|mousse|rice|grain|quinoa|couscous|grits|mashed|cottage|applesauce|gravy|curry(?!.*chicken)|dressing|pesto|tahini|tzatziki|aioli|sour cream|cream cheese|baba|chutney/i,
  },
  {
    id: 'scoop', label: 'Scoop', icon: '🍨', multiplier: 0.5,
    match: /ice cream|soft serve|gelato|sorbet|frozen yogurt|rice|mashed|potato salad|tuna salad|chicken salad|egg salad|coleslaw|mac.*cheese|cottage|granola/i,
  },
  {
    id: 'slice', label: 'Slice', icon: '🍕', multiplier: 0.5,
    match: /pizza|bread|toast|cake|pie|quiche|meatloaf|meat loaf|ham\b|turkey breast|roast beef|watermelon|cantaloupe|honeydew|melon|french toast|focaccia|cornbread|banana bread|pound cake|cheesecake|flatbread|ciabatta|frittata|lasagna|loaf/i,
  },
  {
    id: 'piece', label: 'Piece', icon: '🍗', multiplier: 1.0,
    match: /chicken|drumstick|thigh|wing|breast|nugget|tender|strip|leg\b|cookie|brownie|muffin|bagel|roll\b|bun\b|biscuit|croissant|donut|doughnut|scone|pretzel|waffle|pancake|egg\b|omelet|omelette|sushi|dumpling|egg roll|spring roll|falafel|samosa|empanada|taco|burrito|wrap|sandwich|slider|burger|hot dog|corn dog|fruit\b|apple\b|banana\b|orange\b|pear\b|peach|plum|nectarine|danish|eclair|cannoli|cupcake|tart\b|crab cake|fish fillet|salmon|tilapia|cod\b|shrimp|rib\b|chop\b|steak/i,
  },
  {
    id: 'cup', label: 'Cup', icon: '🥤', multiplier: 1.0,
    match: /soup|chili|stew|salad|vegetable|broccoli|carrot|corn\b|peas\b|green bean|rice|cereal|yogurt|fruit|berr|grape|cherry|cherries|melon|juice|milk|coffee|tea\b|lemonade|water\b|smoothie|shake|cider|cocoa|hot chocolate|granola|oatmeal|chowder|bisque|gumbo|coleslaw|bean|lentil|edamame|kimchi|couscous|quinoa|grits|cottage|applesauce/i,
  },
  {
    id: 'bowl', label: 'Bowl', icon: '🥣', multiplier: 1.5,
    match: /soup|chili|stew|cereal|salad|pasta|spaghetti|penne|linguine|fettuccin|rigatoni|rotini|mac.*cheese|noodle|ramen|udon|lo mein|chow mein|pad thai|rice|oatmeal|stir.?fry|curry|gumbo|chowder|bisque|pho|fried rice|jambalaya|risotto|grain bowl|poke|acai|bibimbap|burrito bowl/i,
  },
  {
    id: 'plate', label: 'Plate', icon: '🍽️', multiplier: 2.0,
    match: /pasta|spaghetti|penne|linguine|fettuccin|rigatoni|stir.?fry|curry|fried rice|chicken.*rice|beef.*rice|salmon|tilapia|fish|entree|special|casserole|lasagna|pot pie|shepherd|jambalaya|risotto|paella|bibimbap|teriyaki|general tso|orange chicken|kung pao|sesame chicken|bourbon chicken/i,
  },
];

function getPortionsForFood(foodName) {
  if (!foodName) return [];
  return PORTION_TYPES.filter((pt) => pt.match.test(foodName));
}

export default function FoodSearch({ mealType, onLog }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [servings, setServings] = useState(1);
  const [portionType, setPortionType] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);

  const availablePortions = useMemo(
    () => selected ? getPortionsForFood(selected.name) : [],
    [selected]
  );

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
    setPortionType(null);
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
    setPortionType(null);
  }

  function selectPortion(pt) {
    setPortionType(pt);
    setServings(pt.multiplier);
  }

  const effectiveServings = servings;
  const portionLabel = portionType
    ? `${servings} ${portionType.label.toLowerCase()}${servings !== 1 ? 's' : ''}`
    : `${servings} serving${servings !== 1 ? 's' : ''}`;

  function handleLog() {
    if (!selected) return;
    onLog({
      food_item_id: selected.food_item_id,
      food_name: selected.name,
      servings: effectiveServings,
      portion_label: portionLabel,
      meal_type: mealType,
      calories: selected.calories,
      protein_g: selected.protein_g,
      total_fat_g: selected.total_fat_g,
      total_carbs_g: selected.total_carbs_g,
    });
    setQuery('');
    setSelected(null);
    setServings(1);
    setPortionType(null);
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
            className="w-full border border-umd-gray rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-umd-red focus:border-transparent"
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-umd-red border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {showResults && results.length > 0 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-umd-gray rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {results.map((item, i) => (
                <button
                  key={i}
                  onClick={() => selectItem(item)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-umd-gray-light transition-colors border-b border-umd-gray-light last:border-b-0"
                >
                  <div className="font-medium text-umd-black">{item.name}</div>
                  <div className="text-xs text-umd-body mt-0.5">
                    {item.calories || 0} cal · {item.protein_g || 0}g protein · {item.total_fat_g || 0}g fat · {item.total_carbs_g || 0}g carbs
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selected && (
        <div className="mt-3 space-y-3">
          {/* Portion type grid — only shows relevant options */}
          {availablePortions.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-umd-black mb-2">How much?</div>
              <div className="flex flex-wrap gap-1.5">
                {availablePortions.map((pt) => (
                  <button
                    key={pt.id}
                    onClick={() => selectPortion(pt)}
                    className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg border text-xs transition-colors ${
                      portionType?.id === pt.id
                        ? 'border-umd-red bg-red-50 text-umd-red font-semibold'
                        : 'border-umd-gray bg-white text-umd-body hover:border-umd-red hover:text-umd-red'
                    }`}
                  >
                    <span className="text-base">{pt.icon}</span>
                    <span>{pt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Serving amount + log button */}
          <div className="flex items-center gap-2">
            <select
              value={servings}
              onChange={(e) => { setServings(parseFloat(e.target.value)); setPortionType(null); }}
              className="border border-umd-gray rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-umd-red w-28"
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
          </div>

          {/* Nutrition preview */}
          <div className="bg-umd-gray-light rounded-lg px-3 py-2 text-xs text-umd-body">
            Per {portionLabel}:{' '}
            <span className="font-semibold text-umd-black">
              {Math.round((selected.calories || 0) * effectiveServings)} cal
            </span>
            {' · '}{Math.round((selected.protein_g || 0) * effectiveServings * 10) / 10}g P
            {' · '}{Math.round((selected.total_fat_g || 0) * effectiveServings * 10) / 10}g F
            {' · '}{Math.round((selected.total_carbs_g || 0) * effectiveServings * 10) / 10}g C
          </div>
        </div>
      )}
    </div>
  );
}
