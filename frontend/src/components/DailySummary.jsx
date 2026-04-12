export default function DailySummary({ totals }) {
  const macros = [
    { label: 'Calories', value: Math.round(totals.calories || 0), unit: '', color: 'text-umd-red' },
    { label: 'Protein', value: Math.round(totals.protein_g || 0), unit: 'g', color: 'text-blue-600' },
    { label: 'Fat', value: Math.round(totals.total_fat_g || 0), unit: 'g', color: 'text-yellow-600' },
    { label: 'Carbs', value: Math.round(totals.total_carbs_g || 0), unit: 'g', color: 'text-green-600' },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-6 py-4">
      <div className="grid grid-cols-4 gap-4 text-center">
        {macros.map((m) => (
          <div key={m.label}>
            <div className={`text-2xl font-bold ${m.color}`}>
              {m.value}{m.unit}
            </div>
            <div className="text-xs text-umd-gray-dark mt-1">{m.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
