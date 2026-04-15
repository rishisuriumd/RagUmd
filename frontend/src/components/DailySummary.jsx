import { useState } from 'react';

export default function DailySummary({ totals }) {
  const protein = Math.round(totals.protein_g || 0);
  const fat = Math.round(totals.total_fat_g || 0);
  const carbs = Math.round(totals.total_carbs_g || 0);
  const calories = Math.round(totals.calories || 0);
  const total = protein + fat + carbs;

  const slices = [
    { label: 'Protein', value: protein, unit: 'g', color: '#3b82f6', light: '#eff6ff' },
    { label: 'Fat', value: fat, unit: 'g', color: '#f97316', light: '#fff7ed' },
    { label: 'Carbs', value: carbs, unit: 'g', color: '#22c55e', light: '#f0fdf4' },
  ];

  const [hovered, setHovered] = useState(null);

  const size = 180;
  const center = size / 2;
  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const sliceData = slices.map((s) => {
    const pct = total > 0 ? s.value / total : 0;
    const dash = pct * circumference;
    const gap = circumference - dash;
    const currentOffset = offset;
    offset += dash;
    return { ...s, pct, dash, gap, offset: currentOffset };
  });

  return (
    <div className="umd-card rounded-2xl p-6">
      <div className="flex flex-col items-center gap-6">
        {/* Donut chart */}
        <div className="relative">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {total > 0 ? (
              sliceData.map((s) => {
                if (s.pct === 0) return null;
                const isHovered = hovered === s.label;
                const isOther = hovered !== null && hovered !== s.label;
                return (
                  <circle
                    key={s.label}
                    cx={center} cy={center} r={radius}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={isHovered ? 28 : 22}
                    strokeDasharray={`${s.dash} ${s.gap}`}
                    strokeDashoffset={-s.offset}
                    strokeLinecap="butt"
                    transform={`rotate(-90 ${center} ${center})`}
                    opacity={isOther ? 0.3 : 1}
                    className="cursor-pointer"
                    style={{ transition: 'stroke-width 0.2s ease, opacity 0.2s ease' }}
                    onMouseEnter={() => setHovered(s.label)}
                    onMouseLeave={() => setHovered(null)}
                  />
                );
              })
            ) : (
              <circle cx={center} cy={center} r={radius} fill="none" stroke="#e6e6e6" strokeWidth="22" />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {hovered && total > 0 ? (
              (() => {
                const s = sliceData.find((s) => s.label === hovered);
                return (
                  <>
                    <span className="text-2xl font-extrabold leading-none" style={{ color: s.color }}>{s.value}g</span>
                    <span className="text-xs font-semibold mt-0.5" style={{ color: s.color }}>{s.label}</span>
                    <span className="text-[10px] text-umd-gray-dark mt-0.5">{Math.round(s.pct * 100)}%</span>
                  </>
                );
              })()
            ) : (
              <>
                <span className="text-3xl font-extrabold text-umd-black leading-none">{calories}</span>
                <span className="text-xs text-umd-gray-dark font-medium mt-0.5">calories</span>
              </>
            )}
          </div>
        </div>

        {/* Macro cards */}
        <div className="grid grid-cols-3 gap-3 w-full">
          {sliceData.map((s) => {
            const pct = total > 0 ? Math.round(s.pct * 100) : 0;
            const isHovered = hovered === s.label;
            const isOther = hovered !== null && hovered !== s.label;
            return (
              <div
                key={s.label}
                className="rounded-xl p-3 text-center cursor-pointer"
                style={{
                  backgroundColor: s.light,
                  opacity: isOther ? 0.4 : 1,
                  transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                  boxShadow: isHovered ? `0 4px 16px ${s.color}30` : 'none',
                  transition: 'opacity 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease',
                }}
                onMouseEnter={() => setHovered(s.label)}
                onMouseLeave={() => setHovered(null)}
              >
                <div className="text-2xl font-bold leading-none" style={{ color: s.color }}>
                  {s.value}<span className="text-sm font-semibold">g</span>
                </div>
                <div className="text-xs font-semibold text-umd-body mt-1.5">{s.label}</div>
                {total > 0 && (
                  <div className="mt-1.5 h-1.5 rounded-full bg-white overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: s.color, transition: 'width 0.5s ease' }}
                    />
                  </div>
                )}
                {total > 0 && (
                  <div className="text-[10px] text-umd-gray-dark mt-1">{pct}%</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
