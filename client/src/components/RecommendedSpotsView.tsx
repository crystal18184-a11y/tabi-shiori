// みんなのおすすめスポット - 一覧・検索ビュー
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { showToast } from "@/contexts/TabiContext";
import type { PoolSpot } from "@/lib/store";
import RecommendedSpotModal from "./RecommendedSpotModal";

const CATEGORIES = ["すべて", "食事", "観光", "宿泊", "買物", "その他"] as const;
const PREFECTURES = [
  "", "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
  "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
  "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
  "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
] as const;

const CATEGORY_ICONS: Record<string, string> = {
  食事: "🍽️",
  観光: "🏛️",
  宿泊: "🏨",
  買物: "🛍️",
  その他: "📍",
};

interface Props {
  onAddToPool: (data: Omit<PoolSpot, "id">) => void;
  userId: string;
  userName: string;
}

export default function RecommendedSpotsView({ onAddToPool, userId, userName }: Props) {
  const [prefecture, setPrefecture] = useState("");
  const [category, setCategory] = useState("すべて");
  const [keyword, setKeyword] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [showModal, setShowModal] = useState(false);

  const { data, isLoading, refetch } = trpc.recommendedSpots.search.useQuery({
    prefecture: prefecture || undefined,
    category: category === "すべて" ? undefined : category,
    keyword: keyword || undefined,
  });

  const spots = data?.spots ?? [];

  const handleSearch = () => {
    setKeyword(searchInput);
  };

  const handleAddToPool = (spot: typeof spots[0]) => {
    onAddToPool({
      name: spot.placeName,
      priority: "行きたい",
      location: spot.address,
      memo: spot.comment,
      url: spot.sourceUrl || "",
      lat: spot.lat || undefined,
      lng: spot.lng || undefined,
    });
    showToast("✓ スポットプールに追加しました", "#22c55e");
  };

  return (
    <div className="flex flex-col h-full">
      {/* 検索フィルター */}
      <div className="bg-white border-b border-gray-100 px-3 py-3 space-y-2">
        {/* キーワード検索 */}
        <div className="flex gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            placeholder="スポット名・住所・コメントで検索..."
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            onClick={handleSearch}
            className="px-3 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition"
          >
            🔍
          </button>
        </div>

        {/* フィルター */}
        <div className="flex gap-2">
          <select
            value={prefecture}
            onChange={e => setPrefecture(e.target.value)}
            className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
          >
            <option value="">都道府県（すべて）</option>
            {PREFECTURES.filter(p => p).map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* スポット一覧 */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {isLoading && (
          <div className="text-center py-8 text-gray-400 text-sm">読み込み中...</div>
        )}
        {!isLoading && spots.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-3">⭐</div>
            <p className="text-sm font-medium">まだおすすめスポットがありません</p>
            <p className="text-xs mt-1">下のボタンから最初の投稿をしてみましょう！</p>
          </div>
        )}
        {spots.map(spot => (
          <div key={spot.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {/* 写真 */}
            {spot.photoUrl && (
              <img
                src={spot.photoUrl}
                alt={spot.placeName}
                className="w-full h-32 object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            )}
            <div className="p-3">
              {/* ヘッダー */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm">{CATEGORY_ICONS[spot.category] || "📍"}</span>
                    <h3 className="font-bold text-sm text-gray-800 truncate">{spot.placeName}</h3>
                    <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full shrink-0">{spot.category}</span>
                  </div>
                  {spot.prefecture && (
                    <p className="text-xs text-gray-400 mt-0.5">📍 {spot.prefecture}</p>
                  )}
                </div>
                {/* 評価 */}
                <div className="flex items-center gap-0.5 shrink-0">
                  {[1, 2, 3, 4, 5].map(n => (
                    <span key={n} className={`text-sm ${n <= spot.rating ? "text-yellow-400" : "text-gray-200"}`}>★</span>
                  ))}
                </div>
              </div>

              {/* 住所 */}
              {spot.address && (
                <p className="text-xs text-gray-500 mt-1.5 truncate">{spot.address}</p>
              )}

              {/* コメント */}
              {spot.comment && (
                <p className="text-xs text-gray-600 mt-1.5 leading-relaxed line-clamp-2">{spot.comment}</p>
              )}

              {/* フッター */}
              <div className="flex items-center justify-between mt-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-400">by {spot.userName}</span>
                  {spot.sourceUrl && (
                    <a
                      href={spot.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline"
                    >
                      🔗 元記事
                    </a>
                  )}
                </div>
                <button
                  onClick={() => handleAddToPool(spot)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  ＋ スポットプールに追加
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 投稿ボタン */}
      <div className="px-3 py-3 border-t border-gray-100 bg-white">
        <button
          onClick={() => setShowModal(true)}
          className="w-full py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl text-sm font-bold hover:from-blue-600 hover:to-blue-700 transition shadow-sm"
        >
          ⭐ おすすめスポットを投稿する
        </button>
      </div>

      {/* 投稿モーダル */}
      {showModal && (
        <RecommendedSpotModal
          userId={userId}
          userName={userName}
          onClose={() => setShowModal(false)}
          onSaved={() => { refetch(); }}
        />
      )}
    </div>
  );
}
