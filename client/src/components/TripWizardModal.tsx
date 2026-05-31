// 旅行作成ウィザード: アプリ起動時または「旅行を追加」時に表示
// 旅行名・目的地・開始日・終了日を入力してDay自動生成
import { useState } from "react";

interface Props {
  onClose: () => void;
  onCreate: (name: string, destination: string, startDate: string, endDate: string) => void;
  isFirstTrip?: boolean; // 初回起動時かどうか（UIを変える）
}

export default function TripWizardModal({ onClose, onCreate, isFirstTrip = false }: Props) {
  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");

  // 日数を計算
  const dayCount = (() => {
    if (!startDate || !endDate) return 0;
    const s = new Date(startDate);
    const e = new Date(endDate);
    const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
    return diff >= 0 ? diff + 1 : 0;
  })();

  function handleCreate() {
    if (!name.trim()) { setError("旅行名を入力してください"); return; }
    if (!startDate) { setError("開始日を入力してください"); return; }
    if (!endDate) { setError("終了日を入力してください"); return; }
    if (new Date(endDate) < new Date(startDate)) { setError("終了日は開始日より後にしてください"); return; }
    if (dayCount > 30) { setError("旅行期間は30日以内にしてください"); return; }
    setError("");
    onCreate(name.trim(), destination.trim(), startDate, endDate);
    onClose();
  }

  // 今日の日付をデフォルト用に取得
  const today = new Date().toISOString().slice(0, 10);

  const overlayStyle: React.CSSProperties = {
    position: "fixed", inset: 0,
    background: "rgba(0,0,0,.55)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 500, padding: 16,
    fontFamily: "'Noto Sans JP','Hiragino Sans',sans-serif",
  };

  const modalStyle: React.CSSProperties = {
    background: "#fff",
    borderRadius: 18,
    width: "100%",
    maxWidth: 420,
    boxShadow: "0 24px 64px rgba(0,0,0,.28)",
    overflow: "hidden",
  };

  const lblStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: "#64748b",
    textTransform: "uppercase" as const, letterSpacing: ".05em",
    marginBottom: 4, display: "block",
  };

  const inpStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box" as const,
    border: "1.5px solid #e2e8f0", borderRadius: 10,
    padding: "10px 12px", fontSize: 14, color: "#0f172a",
    outline: "none", fontFamily: "inherit",
    background: "#f8fafc",
  };

  return (
    <div style={overlayStyle} onClick={e => e.target === e.currentTarget && !isFirstTrip && onClose()}>
      <div style={modalStyle}>
        {/* ヘッダー */}
        <div style={{
          background: "linear-gradient(135deg, #3b82f6, #6366f1)",
          padding: "20px 20px 16px",
          color: "#fff",
        }}>
          <div style={{ fontSize: 22, marginBottom: 4 }}>✈️</div>
          <div style={{ fontSize: 17, fontWeight: 800, fontFamily: "'Noto Serif JP',serif" }}>
            {isFirstTrip ? "旅のしおりへようこそ！" : "新しい旅行を作成"}
          </div>
          <div style={{ fontSize: 12, opacity: .85, marginTop: 4, lineHeight: 1.5 }}>
            {isFirstTrip
              ? "まず最初の旅行プランを作りましょう。旅行名・目的地・期間を入力してください。"
              : "旅行名・目的地・期間を入力すると、Day1・Day2...が自動で作成されます。"
            }
          </div>
        </div>

        {/* フォーム */}
        <div style={{ padding: "20px 20px 16px", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* 旅行名 */}
          <div>
            <label style={lblStyle}>旅行名 *</label>
            <input
              value={name}
              onChange={e => { setName(e.target.value); setError(""); }}
              placeholder="例：鹿児島旅行、沖縄2泊3日"
              style={inpStyle}
              autoFocus
            />
          </div>

          {/* 目的地 */}
          <div>
            <label style={lblStyle}>目的地・旅行場所</label>
            <input
              value={destination}
              onChange={e => setDestination(e.target.value)}
              placeholder="例：鹿児島、沖縄、京都"
              style={inpStyle}
            />
          </div>

          {/* 期間 */}
          <div>
            <label style={lblStyle}>旅行期間 *</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="date"
                value={startDate}
                min={today}
                onChange={e => {
                  setStartDate(e.target.value);
                  setError("");
                  // 終了日が開始日より前なら開始日に合わせる
                  if (endDate && e.target.value > endDate) setEndDate(e.target.value);
                }}
                style={{ ...inpStyle, flex: 1 }}
              />
              <span style={{ color: "#94a3b8", fontSize: 12, flexShrink: 0 }}>〜</span>
              <input
                type="date"
                value={endDate}
                min={startDate || today}
                onChange={e => { setEndDate(e.target.value); setError(""); }}
                style={{ ...inpStyle, flex: 1 }}
              />
            </div>
            {dayCount > 0 && (
              <div style={{ marginTop: 6, fontSize: 11, color: "#3b82f6", fontWeight: 700 }}>
                📅 {dayCount}日間（Day1〜Day{dayCount}が自動作成されます）
              </div>
            )}
          </div>

          {/* エラー */}
          {error && (
            <div style={{ fontSize: 12, color: "#ef4444", background: "#fef2f2", borderRadius: 8, padding: "8px 12px", fontWeight: 600 }}>
              ⚠️ {error}
            </div>
          )}

          {/* ボタン */}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            {!isFirstTrip && (
              <button
                onClick={onClose}
                style={{ flex: 1, padding: "11px", background: "#f1f5f9", border: "none", borderRadius: 10, color: "#64748b", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                キャンセル
              </button>
            )}
            <button
              onClick={handleCreate}
              style={{
                flex: 2, padding: "11px",
                background: "linear-gradient(135deg, #3b82f6, #6366f1)",
                border: "none", borderRadius: 10,
                color: "#fff", fontSize: 14, fontWeight: 800,
                cursor: "pointer", boxShadow: "0 4px 12px rgba(99,102,241,.35)",
              }}
            >
              {isFirstTrip ? "✈️ 旅行プランを作成する" : "＋ 作成する"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
