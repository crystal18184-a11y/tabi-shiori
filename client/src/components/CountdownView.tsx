// カウントダウンビュー（Tailwind CSS化・アクセシビリティ対応済み）
import { useEffect, useState } from "react";
import type { Trip } from "@/lib/store";

function getFirstDate(trip: Trip | null): string | null {
  if (!trip) return null;
  const dates = trip.days.map(d => d.date).filter(Boolean).sort();
  return dates[0] || null;
}

export default function CountdownView({ trip }: { trip: Trip | null }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const firstDate = getFirstDate(trip);
  if (!firstDate) {
    return (
      <div role="status" className="flex-1 flex flex-col items-center justify-center gap-3 text-m3-on-surface-variant p-6">
        <span className="text-5xl">⏳</span>
        <p className="text-sm">旅行の日程を設定するとカウントダウンが表示されます</p>
      </div>
    );
  }

  const [y, m, d] = firstDate.split("-").map(Number);
  const target = new Date(y, m - 1, d, 0, 0, 0, 0);
  const diffMs = target.getTime() - now.getTime();
  const isPast = diffMs < 0;
  const absDiff = Math.abs(diffMs);
  const days = Math.floor(absDiff / 86400000);
  const hours = Math.floor((absDiff % 86400000) / 3600000);
  const minutes = Math.floor((absDiff % 3600000) / 60000);
  const seconds = Math.floor((absDiff % 60000) / 1000);

  return (
    <section
      aria-label="出発カウントダウン"
      aria-live="polite"
      className="flex-1 flex flex-col items-center justify-center gap-6 p-6 bg-gradient-to-br from-slate-50 to-blue-50"
    >
      <div className="text-center">
        <p className="text-m3-on-surface-variant text-sm font-semibold mb-1">
          {trip?.destination ? `📍 ${trip.destination}` : "✈️ 旅の出発"}
        </p>
        <p className="text-m3-on-surface-variant text-xs">{firstDate}</p>
      </div>

      {isPast ? (
        <div className="text-center">
          <div className="text-6xl mb-3">🎉</div>
          <p className="text-2xl font-black text-blue-600">旅行中 / 旅行済み</p>
          <p className="text-m3-on-surface-variant text-sm mt-2">{days}日が経過しました</p>
        </div>
      ) : (
        <div className="flex gap-3 items-end justify-center flex-wrap" role="timer">
          {[
            { value: days, label: "日" },
            { value: hours, label: "時間" },
            { value: minutes, label: "分" },
            { value: seconds, label: "秒" },
          ].map(({ value, label }) => (
            <div key={label} className="flex flex-col items-center bg-m3-surface rounded-2xl m3-elevation-1 px-4 py-3 min-w-[64px] border border-m3-outline-variant">
              <span className="text-4xl font-black text-m3-on-surface tabular-nums leading-none">
                {String(value).padStart(2, "0")}
              </span>
              <span className="text-[11px] font-bold text-m3-on-surface-variant mt-1">{label}</span>
            </div>
          ))}
        </div>
      )}

      <p className="text-m3-on-surface-variant text-xs">
        {isPast ? "旅行開始から" : "出発まで あと"}
      </p>
    </section>
  );
}
