// 地図サイドバー（Tailwind CSS化・アクセシビリティ対応済み・Day単位スポット分類・スポットクリック地図フォーカス）
import { hasCoord } from "@/lib/store";
import type { Trip } from "@/lib/store";

interface Props {
  trip: Trip | null;
  mapMode: "all" | "day";
  currentDid: string;
  onFocusEvent: (eid: string) => void;
  isOpen: boolean;
}

export default function MapSidebar({ trip, mapMode, currentDid, onFocusEvent, isOpen }: Props) {
  if (!isOpen) return null;

  const daysToShow = mapMode === "all" ? (trip?.days || []) : (trip?.days || []).filter(d => d.id === currentDid);

  // Day ごとに予定とスポットをグループ化
  const dayGroups = daysToShow.map(day => ({
    day,
    events: (day.events || []).filter(e => hasCoord(e)),
    spots: (day.pool || []).filter(p => hasCoord(p)),
  }));

  // 座標を持つ予定またはスポットがあるDayのみを表示
  const visibleDayGroups = dayGroups.filter(g => g.events.length > 0 || g.spots.length > 0);

  return (
    <aside
      aria-label="スポット一覧"
      className="w-48 bg-m3-surface border-l border-m3-outline-variant flex flex-col overflow-hidden flex-shrink-0 m3-elevation-2"
    >
      <div className="px-2.5 py-2 border-b border-m3-outline-variant bg-m3-surface-variant">
        <h2 className="text-[10px] font-bold text-m3-on-surface-variant uppercase tracking-wider">
          📍 スポット一覧
        </h2>
      </div>
      <nav aria-label="地図スポット" className="flex-1 overflow-y-auto">
        {visibleDayGroups.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-m3-on-surface-variant">
            <span className="text-3xl">🗺️</span>
            <p className="text-[11px] text-center">座標のある予定がありません</p>
          </div>
        )}

        {visibleDayGroups.map((group, idx) => (
          <div key={group.day.id} className={idx > 0 ? "border-t border-m3-outline-variant" : ""}>
            {/* Day ヘッダー */}
            <div className="px-2.5 py-2 bg-m3-surface-variant border-b border-m3-outline-variant sticky top-0 z-10">
              <div className="text-[10px] font-bold text-m3-on-surface-variant uppercase tracking-wider">
                {group.day.name || `Day ${idx + 1}`}
              </div>
            </div>

            {/* 予定 */}
            {group.events.length > 0 && (
              <div className="p-1.5">
                <div className="text-[9px] font-bold text-m3-on-surface-variant uppercase tracking-wider px-1.5 py-1">
                  予定
                </div>
                {group.events.map(e => (
                  <button
                    key={e.id}
                    onClick={() => onFocusEvent(e.id)}
                    aria-label={`${e.title}の位置を地図に表示`}
                    className="w-full text-left bg-transparent border-none rounded-lg px-2 py-1.5 cursor-pointer hover:bg-m3-surface-variant transition-colors"
                  >
                    <div className="text-xs font-semibold text-m3-on-surface truncate">{e.title}</div>
                    {e.location && <div className="text-[10px] text-m3-on-surface-variant truncate">📍 {e.location}</div>}
                  </button>
                ))}
              </div>
            )}

            {/* スポット */}
            {group.spots.length > 0 && (
              <div className={group.events.length > 0 ? "p-1.5 border-t border-m3-outline-variant" : "p-1.5"}>
                <div className="text-[9px] font-bold text-amber-500 uppercase tracking-wider px-1.5 py-1">
                  ★ 行きたい
                </div>
                {group.spots.map(p => (
                  <button
                    key={p.id}
                    onClick={() => onFocusEvent(`pool_${p.id}`)}
                    aria-label={`${p.name}の位置を地図に表示`}
                    className="w-full text-left bg-transparent border-none rounded-lg px-2 py-1.5 cursor-pointer hover:bg-amber-50 transition-colors"
                  >
                    <div className="text-xs font-semibold text-m3-on-surface truncate">{p.name}</div>
                    {p.location && <div className="text-[10px] text-m3-on-surface-variant truncate">📍 {p.location}</div>}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
}
