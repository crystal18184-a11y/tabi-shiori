// 天気予報バッジコンポーネント
// 日付・旅行先から天気予報を取得してアイコン表示する
import { trpc } from "@/lib/trpc";

interface WeatherBadgeProps {
  date: string;        // YYYY-MM-DD
  destination?: string;
  lat?: number;
  lng?: number;
  compact?: boolean;
}

/**
 * YYYY-MM-DD 文字列をローカルタイムゾーンの Date として生成する
 * new Date("2026-03-01") は UTC 00:00 になり JST では前日扱いになるため
 * ローカル日付として解釈することでタイムゾーンのずれを防ぐ（バグ3修正）
 */
function parseDateLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export default function WeatherBadge({ date, destination, lat, lng, compact = false }: WeatherBadgeProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const targetDate = date ? parseDateLocal(date) : null;
  const diffDays = targetDate ? Math.ceil((targetDate.getTime() - today.getTime()) / 86400000) : null;

  // Open-Meteo は16日先まで予報可能、過去1日まで参照可
  const canFetch = !!(date && diffDays !== null && diffDays >= -1 && diffDays <= 16);

  const { data, isLoading, refetch, isFetching } = trpc.weather.getForecast.useQuery(
    { date, lat, lng, location: destination || undefined },
    {
      enabled: canFetch,
      staleTime: 1000 * 60 * 10, // 10分キャッシュ（バグ2対策：同一目的地の重複リクエストを抑制）
      gcTime: 1000 * 60 * 30,
      retry: 1,
      retryDelay: 3000,
    }
  );

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    refetch();
  };

  if (!canFetch) return null;

  if (isLoading) {
    return <span className="inline-flex items-center gap-0.5 text-slate-400 text-[9px]">🌡️</span>;
  }

  if (!data?.ok) {
    return (
      <button
        onClick={handleRefresh}
        title="天気予報を再取得"
        aria-label="天気予報を再取得"
        className={`bg-transparent border-none cursor-pointer text-slate-400 p-0.5 leading-none transition-opacity ${isFetching ? "opacity-50" : ""}`}
      >
        {isFetching ? "⏳" : "🌡️"}
      </button>
    );
  }

  if (compact) {
    return (
      <span
        title={`${data.label} 最高${data.tempMax}℃ 最低${data.tempMin}℃${data.precipitation ? ` 降水${data.precipitation}mm` : ""}\nクリックで更新`}
        className="inline-flex items-center gap-0.5 leading-none cursor-pointer text-xs"
        onClick={handleRefresh}
        role="button"
        aria-label={`天気: ${data.label}。クリックで更新`}
      >
        {isFetching ? (
          <span className="text-[9px] text-slate-400">⏳</span>
        ) : (
          <>
            {data.icon}
            {data.tempMax !== null && data.tempMin !== null && (
              <span className="text-[9px] text-slate-500 font-semibold">{data.tempMax}°/{data.tempMin}°</span>
            )}
          </>
        )}
      </span>
    );
  }

  return (
    <div className="inline-flex items-center gap-1 bg-sky-50 border border-sky-200 rounded-xl px-2 py-0.5 text-[11px] text-sky-700 font-semibold">
      <span className="text-sm">{data.icon}</span>
      <span>{data.label}</span>
      {data.tempMax !== null && data.tempMin !== null && (
        <span className="text-[10px] text-slate-500">{data.tempMax}°/{data.tempMin}°</span>
      )}
      {data.precipitation !== null && data.precipitation > 0 && (
        <span className="text-[10px] text-sky-500">💧{data.precipitation}mm</span>
      )}
      <button
        onClick={handleRefresh}
        title="天気予報を更新"
        aria-label="天気予報を更新"
        className={`bg-transparent border-none cursor-pointer text-slate-400 p-0 leading-none transition-opacity hover:text-slate-600 ${isFetching ? "opacity-50" : "opacity-70"}`}
      >
        {isFetching ? "⏳" : "🔄"}
      </button>
    </div>
  );
}
