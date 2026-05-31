// 旅のしおり - インスタプロフィールリンク用ランディングページ
// /link でアクセス可能・ログイン不要・スマホ最適化
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

const INSTAGRAM_URL = import.meta.env.VITE_INSTAGRAM_URL || "https://www.instagram.com/";
const APP_URL = "/";

interface SpotData {
  placeName: string;
  category: string;
  prefecture: string;
  comment: string;
  userName: string;
  rating: number;
}

// おすすめスポットカード
function SpotCard({ spot }: { spot: SpotData }) {
  const stars = "★".repeat(spot.rating) + "☆".repeat(5 - spot.rating);
  return (
    <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100 flex flex-col gap-1 min-w-0">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">{spot.category}</span>
        <span className="text-[10px] text-slate-400">{spot.prefecture}</span>
      </div>
      <p className="text-sm font-bold text-slate-900 leading-tight">{spot.placeName}</p>
      <p className="text-[10px] text-amber-500">{stars}</p>
      <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">{spot.comment}</p>
      <p className="text-[10px] text-slate-400">by {spot.userName}</p>
    </div>
  );
}

export default function LinkPage() {
  const [spots, setSpots] = useState<SpotData[]>([]);

  // おすすめスポット最新3件を取得
  const searchSpots = trpc.recommendedSpots?.search?.useQuery
    ? trpc.recommendedSpots.search.useQuery({ limit: 3 } as never, { retry: false })
    : null;

  useEffect(() => {
    if (searchSpots?.data) {
      const raw = searchSpots.data as unknown as { spots?: SpotData[] };
      setSpots(raw.spots?.slice(0, 3) || []);
    }
  }, [searchSpots?.data]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex flex-col items-center justify-start py-10 px-4">
      <div className="w-full max-w-sm flex flex-col gap-5">

        {/* ロゴ・キャッチコピー */}
        <div className="text-center flex flex-col gap-3 py-4">
          <div className="text-5xl">✈️</div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">旅のしおり</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            旅行をもっと楽しく、もっとスマートに。<br />
            旅程・割り勘・地図・おすすめスポットを<br />
            <span className="font-bold text-blue-600">1つのアプリで。</span>
          </p>
        </div>

        {/* メインボタン群 */}
        <div className="flex flex-col gap-3">
          <a
            href={APP_URL}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-2xl py-4 px-6 text-sm font-bold shadow-lg shadow-blue-200 hover:from-blue-600 hover:to-indigo-600 transition-all active:scale-95 no-underline"
          >
            <span className="text-lg">🗓️</span>
            <span>アプリを使ってみる（無料）</span>
          </a>

          <a
            href={`${APP_URL}#recommended`}
            className="flex items-center justify-center gap-2 bg-white text-slate-700 rounded-2xl py-4 px-6 text-sm font-bold shadow-sm border border-slate-200 hover:bg-slate-50 transition-all active:scale-95 no-underline"
          >
            <span className="text-lg">⭐</span>
            <span>みんなのおすすめスポット</span>
          </a>

          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-pink-500 to-rose-400 text-white rounded-2xl py-4 px-6 text-sm font-bold shadow-sm hover:from-pink-600 hover:to-rose-500 transition-all active:scale-95 no-underline"
          >
            <span className="text-lg">📸</span>
            <span>インスタをフォローする</span>
          </a>
        </div>

        {/* 機能紹介 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">できること</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: "🗓️", label: "旅程管理", desc: "タイムライン形式で" },
              { icon: "🗺️", label: "地図表示", desc: "スポットを地図で確認" },
              { icon: "💴", label: "割り勘計算", desc: "精算を自動計算" },
              { icon: "⭐", label: "おすすめ共有", desc: "みんなで地図を作る" },
            ].map(f => (
              <div key={f.label} className="flex items-start gap-2 p-2 rounded-xl bg-slate-50">
                <span className="text-xl">{f.icon}</span>
                <div>
                  <p className="text-xs font-bold text-slate-800">{f.label}</p>
                  <p className="text-[10px] text-slate-400">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* おすすめスポット */}
        {spots.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">⭐ 最近のおすすめスポット</p>
            <div className="flex flex-col gap-2">
              {spots.map((s, i) => <SpotCard key={i} spot={s} />)}
            </div>
          </div>
        )}

        {/* フッター */}
        <div className="text-center py-4">
          <p className="text-[11px] text-slate-400">
            © 旅のしおり · <a href={APP_URL} className="text-blue-400 no-underline hover:underline">アプリを開く</a>
          </p>
        </div>
      </div>
    </div>
  );
}
