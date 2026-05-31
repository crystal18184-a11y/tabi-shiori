// みんなのおすすめスポット - 投稿モーダル
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { showToast } from "@/contexts/TabiContext";

const CATEGORIES = ["食事", "観光", "宿泊", "買物", "その他"] as const;
const PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
  "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
  "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
  "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
] as const;

interface Props {
  userId: string;
  userName: string;
  onClose: () => void;
  onSaved: () => void;
  initialData?: {
    name?: string;
    address?: string;
    category?: string;
    lat?: string;
    lng?: string;
    url?: string;
  };
}

export default function RecommendedSpotModal({ userId, userName, onClose, onSaved, initialData }: Props) {
  const [sourceUrl, setSourceUrl] = useState("");
  const [placeName, setPlaceName] = useState("");
  const [category, setCategory] = useState<string>("食事");
  const [prefecture, setPrefecture] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [rating, setRating] = useState(3);
  const [comment, setComment] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [parsing, setParsing] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const parseUrlMutation = trpc.recommendedSpots.parseUrl.useMutation();
  const createMutation = trpc.recommendedSpots.create.useMutation();

  // 初期値を設定
  useEffect(() => {
    if (initialData) {
      if (initialData.name) setPlaceName(initialData.name);
      if (initialData.address) setAddress(initialData.address);
      if (initialData.category && CATEGORIES.includes(initialData.category as typeof CATEGORIES[number])) {
        setCategory(initialData.category);
      }
      if (initialData.lat) setLat(initialData.lat);
      if (initialData.lng) setLng(initialData.lng);
      if (initialData.url) setSourceUrl(initialData.url);
    }
  }, [initialData]);

  const handleParseUrl = async () => {
    if (!sourceUrl.trim()) return;
    setParsing(true);
    try {
      const res = await parseUrlMutation.mutateAsync({ url: sourceUrl.trim() });
      if (res.success) {
        if (res.placeName) setPlaceName(res.placeName);
        if (res.address) setAddress(res.address);
        if (res.prefecture) setPrefecture(res.prefecture);
        if (res.category && CATEGORIES.includes(res.category as typeof CATEGORIES[number])) {
          setCategory(res.category);
        }
        if (res.comment) setComment(res.comment);
        if (res.photoUrl) setPhotoUrl(res.photoUrl);
        if (res.lat) setLat(res.lat);
        if (res.lng) setLng(res.lng);
        showToast("✓ 自動解析完了", "#22c55e");
      } else {
        showToast(res.error || "解析に失敗しました", "#ef4444");
      }
    } catch {
      showToast("URLの解析に失敗しました", "#ef4444");
    } finally {
      setParsing(false);
    }
  };

  const handleGeocode = async () => {
    const q = address.trim() || placeName.trim();
    if (!q) { showToast("住所または店名を入力してください", "#ef4444"); return; }
    setGeoLoading(true);
    try {
      const params = new URLSearchParams({
        format: "json", q, limit: "1",
        "accept-language": "ja", countrycodes: "jp",
      });
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { "User-Agent": "TabiShiori/1.0" },
      });
      const data = await res.json();
      if (data[0]) {
        setLat(data[0].lat);
        setLng(data[0].lon);
        showToast("✓ 座標を取得しました", "#22c55e");
      } else {
        showToast("座標が見つかりませんでした", "#ef4444");
      }
    } catch {
      showToast("座標取得に失敗しました", "#ef4444");
    } finally {
      setGeoLoading(false);
    }
  };

  const handleSave = async () => {
    if (!placeName.trim()) { showToast("店名・スポット名を入力してください", "#ef4444"); return; }
    setSaving(true);
    try {
      await createMutation.mutateAsync({
        placeName: placeName.trim(),
        category,
        address: address.trim(),
        lat,
        lng,
        comment: comment.trim(),
        rating,
        sourceUrl: sourceUrl.trim(),
        photoUrl: photoUrl.trim(),
        prefecture,
        userId,
        userName,
      });
      showToast("✓ おすすめスポットを登録しました", "#22c55e");
      onSaved();
      onClose();
    } catch {
      showToast("登録に失敗しました", "#ef4444");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between rounded-t-2xl">
          <h2 className="font-bold text-base text-gray-800">⭐ おすすめスポットを投稿</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        <div className="px-4 py-4 space-y-4">
          {/* SNS URL */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">SNS URL（任意）</label>
            <div className="flex gap-2">
              <input
                type="url"
                value={sourceUrl}
                onChange={e => setSourceUrl(e.target.value)}
                placeholder="https://tabelog.com/... など"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <button
                onClick={handleParseUrl}
                disabled={parsing || !sourceUrl.trim()}
                className="px-3 py-2 bg-blue-500 text-white text-xs rounded-lg disabled:opacity-40 hover:bg-blue-600 transition whitespace-nowrap"
              >
                {parsing ? "解析中..." : "🔍 自動解析"}
              </button>
            </div>
          </div>

          {/* 店名・スポット名 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">店名・スポット名 <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={placeName}
              onChange={e => setPlaceName(e.target.value)}
              placeholder="例：あぢもり、桜島展望台"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* カテゴリ・都道府県 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">カテゴリ</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">都道府県</label>
              <select
                value={prefecture}
                onChange={e => setPrefecture(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              >
                <option value="">選択してください</option>
                {PREFECTURES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* 住所 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">住所</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="例：鹿児島県鹿児島市千日町..."
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <button
                onClick={handleGeocode}
                disabled={geoLoading}
                className="px-3 py-2 bg-green-500 text-white text-xs rounded-lg disabled:opacity-40 hover:bg-green-600 transition whitespace-nowrap"
              >
                {geoLoading ? "取得中..." : "📍 座標取得"}
              </button>
            </div>
            {lat && lng && (
              <p className="text-xs text-green-600 mt-1">✓ 座標取得済み ({parseFloat(lat).toFixed(4)}, {parseFloat(lng).toFixed(4)})</p>
            )}
          </div>

          {/* 評価 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">評価</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setRating(n)}
                  className={`text-2xl transition ${n <= rating ? "text-yellow-400" : "text-gray-300"}`}
                >
                  ★
                </button>
              ))}
              <span className="text-sm text-gray-500 ml-1 self-center">{rating}/5</span>
            </div>
          </div>

          {/* おすすめコメント */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">おすすめコメント</label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="おすすめポイントや注意事項など..."
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            />
          </div>

          {/* 写真URL */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">写真URL（任意）</label>
            <input
              type="url"
              value={photoUrl}
              onChange={e => setPhotoUrl(e.target.value)}
              placeholder="https://..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* 保存ボタン */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition"
            >
              キャンセル
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !placeName.trim()}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold disabled:opacity-40 hover:bg-blue-700 transition"
            >
              {saving ? "登録中..." : "✓ 登録する"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
