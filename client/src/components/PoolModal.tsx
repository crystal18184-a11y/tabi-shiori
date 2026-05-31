// 旅のしおり - スポットプール追加/編集モーダル
// AI場所候補検索・Google Maps URL解析・座標取得対応
import { useState, useRef } from "react";
import { PCATS } from "@/lib/store";
import type { TabiDay, PoolSpot } from "@/lib/store";
import { geocodeByName } from "@/lib/geocode";
import { trpc } from "@/lib/trpc";

interface Props {
  day: TabiDay | undefined;
  editPoolId: string | null;
  destination?: string; // 旅行先（AI検索のコンテキスト用）
  onClose: () => void;
  onSave: (data: Omit<PoolSpot, "id">) => void;
}

interface PlaceCandidate {
  name: string;
  address: string;
  category: string;
  mapsUrl: string;
}

export default function PoolModal({ day, editPoolId, destination, onClose, onSave }: Props) {
  const existing = editPoolId ? day?.pool?.find(p => p.id === editPoolId) : null;
  const [name, setName] = useState(existing?.name || "");
  const [priority, setPriority] = useState(existing?.priority || "絶対行く");
  const [location, setLocation] = useState(existing?.location || "");
  const [memo, setMemo] = useState(existing?.memo || "");
  const [url, setUrl] = useState(existing?.url || "");

  // ジオコーディング状態
  const [geoStatus, setGeoStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  // 座標（地図表示に使用）
  const [lat, setLat] = useState(existing?.lat || "");
  const [lng, setLng] = useState(existing?.lng || "");

  // AI場所候補
  const [placeCandidates, setPlaceCandidates] = useState<PlaceCandidate[]>([]);
  const [aiSearching, setAiSearching] = useState(false);
  const [showCandidates, setShowCandidates] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // サーバーサイドURL解析ミューテーション
  const resolveMapUrlMutation = trpc.geo.resolveMapUrl.useMutation();
  // AI場所候補検索ミューテーション
  const searchPlacesMutation = trpc.places.search.useMutation();

  /**
   * スポット名変更時にAI場所候補を検索（デバウンス600ms）
   */
  function handleNameChange(val: string) {
    setName(val);
    setShowCandidates(false);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (val.trim().length < 2) { setPlaceCandidates([]); return; }
    searchTimerRef.current = setTimeout(async () => {
      setAiSearching(true);
      try {
        const result = await searchPlacesMutation.mutateAsync({
          query: val.trim(),
          destination: destination || undefined,
        });
        if (result.places && result.places.length > 0) {
          setPlaceCandidates(result.places);
          setShowCandidates(true);
        }
      } catch {
        // 検索失敗は無視
      }
      setAiSearching(false);
    }, 600);
  }

  /**
   * AI候補を選択したとき: URL・住所を自動入力
   */
  function handleSelectCandidate(p: PlaceCandidate & { lat?: string; lng?: string }) {
    setName(p.name);
    setUrl(p.mapsUrl);
    setLocation(p.address);
    setShowCandidates(false);
    if (p.lat && p.lng) {
      // Nominatimから取得した実座標を直接使用（AIによる生成ではない）
      setLat(parseFloat(p.lat).toFixed(6));
      setLng(parseFloat(p.lng).toFixed(6));
      setGeoStatus({ msg: `✅ 「${p.name}」の座標を取得しました`, ok: true });
    } else {
      setGeoStatus({ msg: `✅ 「${p.name}」の住所を設定しました。📍 確認 で座標を取得してください`, ok: true });
    }
  }

  /**
   * Google Maps URL解析（サーバーサイド）
   */
  async function handleResolveUrl() {
    if (!url.trim()) {
      setGeoStatus({ msg: "Google Maps URLを入力してください", ok: false });
      return;
    }
    setGeoLoading(true);
    setGeoStatus({ msg: "🔍 URLを解析中...", ok: true });

    try {
      const result = await resolveMapUrlMutation.mutateAsync({ url: url.trim() });

      if (result.address) {
        setLocation(result.address);
        setGeoStatus({ msg: `✓ 住所を取得しました：${result.address}`, ok: true });
      } else if (result.lat && result.lng) {
        setLat(result.lat); setLng(result.lng);
        setGeoStatus({ msg: `✓ 座標を取得しました（緯度 ${result.lat}、経度 ${result.lng}）`, ok: true });
      } else {
        setGeoStatus({ msg: "✗ URLから情報を取得できませんでした。住所を直接入力してください", ok: false });
      }
    } catch {
      setGeoStatus({ msg: "✗ URL解析に失敗しました", ok: false });
    }
    setGeoLoading(false);
  }

  /**
   * 住所テキストから場所を確認（Nominatim）
   */
  async function handleGeocodeLoc() {
    const q = location.trim() || name.trim();
    if (!q) {
      setGeoStatus({ msg: "場所名または住所を入力してください", ok: false });
      return;
    }
    setGeoLoading(true);
    setGeoStatus({ msg: "📍 場所を検索中...", ok: true });
    const result = await geocodeByName(q);
    if (result) {
      setLat(result.lat); setLng(result.lng);
      setGeoStatus({ msg: `✓ 場所を確認しました：${result.displayName}`, ok: true });
    } else {
      setGeoStatus({ msg: "✗ 場所が見つかりませんでした。より詳しい住所を入力してみてください", ok: false });
    }
    setGeoLoading(false);
  }

  function handleSave() {
    if (!name.trim()) { alert("場所を入力してください"); return; }
    onSave({
      name: name.trim(), priority, location, memo, url,
      lat: lat || undefined,
      lng: lng || undefined,
    });
  }

  return (
    <div style={overlayStyle} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={mHeadStyle}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{editPoolId ? "スポットを編集" : "スポットを追加"}</span>
          <button onClick={onClose} style={cancelBtnStyle}>×</button>
        </div>
        <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>

          {/* スポット名（AI候補検索付き） */}
          <div style={{ ...frStyle, position: "relative" }}>
            <label style={lblStyle}>
              場所 *
              {aiSearching && <span style={{ fontWeight: 400, color: "#3b82f6", marginLeft: 6 }}>🔍 検索中...</span>}
            </label>
            <input
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              onFocus={() => placeCandidates.length > 0 && setShowCandidates(true)}
              placeholder="例：桜島（入力すると場所候補が表示されます）"
              style={inpStyle}
              autoComplete="off"
            />
            {/* AI候補ドロップダウン */}
            {showCandidates && placeCandidates.length > 0 && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0, zIndex: 400,
                background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
                boxShadow: "0 8px 24px rgba(0,0,0,.12)", overflow: "hidden", marginTop: 2,
              }}>
                <div style={{ padding: "6px 10px 4px", fontSize: 10, fontWeight: 700, color: "#64748b", borderBottom: "1px solid #f1f5f9" }}>
                  📍 場所候補（クリックで選択）
                </div>
                {placeCandidates.map((p, i) => (
                  <div
                    key={i}
                    onClick={() => handleSelectCandidate(p)}
                    style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid #f8fafc", display: "flex", flexDirection: "column", gap: 2 }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={e => (e.currentTarget.style.background = "")}
                  >
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{p.name}</span>
                    <span style={{ fontSize: 10, color: "#64748b" }}>📍 {p.address}</span>
                    <span style={{ fontSize: 10, color: "#3b82f6" }}>{p.category}</span>
                  </div>
                ))}
                <div
                  onClick={() => setShowCandidates(false)}
                  style={{ padding: "6px 12px", fontSize: 10, color: "#94a3b8", cursor: "pointer", textAlign: "center" }}
                >閉じる</div>
              </div>
            )}
          </div>

          {/* 優先度 */}
          <div style={frStyle}>
            <label style={lblStyle}>優先度</label>
            <div style={{ display: "flex", gap: 6 }}>
              {Object.entries(PCATS).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => setPriority(k)}
                  style={{
                    flex: 1,
                    background: priority === k ? v.c : "#f8fafc",
                    border: `1px solid ${priority === k ? v.c : "#e2e8f0"}`,
                    borderRadius: 7,
                    color: priority === k ? "#fff" : "#64748b",
                    padding: "6px 3px",
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >{v.i} {k}</button>
              ))}
            </div>
          </div>

          {/* Google Maps URLフィールド */}
          <div style={frStyle}>
            <label style={lblStyle}>
              Google Maps URL
              <span style={{ fontWeight: 400, color: "#94a3b8", marginLeft: 4 }}>（短縮URL maps.app.goo.gl も対応）</span>
            </label>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://maps.app.goo.gl/..."
                style={{ ...inpStyle, flex: 1 }}
              />
              <button onClick={handleResolveUrl} disabled={geoLoading} style={{ ...geoBtnStyle, background: "#eff6ff", color: "#3b82f6", borderColor: "#bfdbfe" }}>
                {geoLoading ? "⏳" : "🔍"} URL解析
              </button>
            </div>
            <span style={{ fontSize: 10, color: "#94a3b8", marginTop: 2, lineHeight: 1.5 }}>
              GoogleマップでURLをコピー → 貼り付け → 「🔍 URL解析」で住所を自動取得
            </span>
          </div>

          {/* 住所フィールド */}
          <div style={frStyle}>
            <label style={lblStyle}>住所</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="例：鹿児島市（URL解析後に自動入力されます）"
                style={{ ...inpStyle, flex: 1 }}
              />
              <button onClick={handleGeocodeLoc} disabled={geoLoading} style={geoBtnStyle}>
                {geoLoading ? "⏳" : "📍"} 確認
              </button>
            </div>
          </div>

          {/* ステータスメッセージ */}
          {geoStatus && (
            <div>
              <span style={{ fontSize: 11, padding: "5px 10px", borderRadius: 6, background: geoStatus.ok ? "#dcfce7" : "#fee2e2", color: geoStatus.ok ? "#166534" : "#991b1b", display: "block", lineHeight: 1.6 }}>
                {geoStatus.msg}
              </span>
            </div>
          )}

          <div style={frStyle}>
            <label style={lblStyle}>メモ</label>
            <textarea value={memo} onChange={e => setMemo(e.target.value)} style={{ ...inpStyle, height: 55, resize: "vertical" }} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 7, padding: "9px 17px 14px", justifyContent: "flex-end", borderTop: "1px solid #f1f5f9" }}>
          <button onClick={onClose} style={cancelBtnStyle}>キャンセル</button>
          <button onClick={handleSave} style={saveBtnStyle}>保存する</button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 12 };
const modalStyle: React.CSSProperties = { background: "#fff", borderRadius: 14, width: "100%", maxWidth: 490, maxHeight: "92vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,.2)", display: "flex", flexDirection: "column" };
const mHeadStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 17px 9px", borderBottom: "1px solid #f1f5f9", flexShrink: 0 };
const frStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4 };
const lblStyle: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em" };
const inpStyle: React.CSSProperties = { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, color: "#1e293b", fontSize: 13, padding: "7px 9px", outline: "none", width: "100%", fontFamily: "inherit" };
const geoBtnStyle: React.CSSProperties = { background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 8, color: "#64748b", padding: "7px 9px", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 };
const cancelBtnStyle: React.CSSProperties = { background: "#f1f5f9", border: "none", borderRadius: 8, color: "#64748b", padding: "7px 15px", fontSize: 12, cursor: "pointer" };
const saveBtnStyle: React.CSSProperties = { background: "linear-gradient(135deg,#3b82f6,#6366f1)", border: "none", borderRadius: 8, color: "#fff", padding: "7px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" };
