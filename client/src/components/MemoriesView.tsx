// 旅のしおり - 旅行の思い出記録ビュー
// 旅行後に写真・コメントを記録してアルバム形式で表示する
import { useRef, useState } from "react";
import type { Memory, TabiDay, Trip } from "@/lib/store";
import { uid } from "@/lib/store";

interface MemoriesViewProps {
  trip: Trip;
  onAddMemory: (memory: Omit<Memory, "id" | "createdAt">) => void;
  onDeleteMemory: (memoryId: string) => void;
  onToggleCompleted: () => void;
}

export default function MemoriesView({ trip, onAddMemory, onDeleteMemory, onToggleCompleted }: MemoriesViewProps) {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [comment, setComment] = useState("");
  const [location, setLocation] = useState("");
  const [selectedDayId, setSelectedDayId] = useState<string>("");
  const [filterDayId, setFilterDayId] = useState<string>("all");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const memories = trip.memories || [];
  const isCompleted = trip.status === "completed";

  // 日程フィルタリング
  const filtered = filterDayId === "all"
    ? memories
    : memories.filter(m => m.dayId === filterDayId);

  // 日付ラベルを取得
  const getDayLabel = (day: TabiDay, idx: number) => {
    if (day.name) return day.name;
    if (day.date) {
      const [, m, d] = day.date.split("-").map(Number);
      return `${m}/${d}`;
    }
    return `Day ${idx + 1}`;
  };

  // 写真選択
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("5MB以下の画像を選択してください");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPhotoPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  // 思い出を追加
  function handleAdd() {
    if (!photoPreview && !comment.trim()) return;
    onAddMemory({
      photoUrl: photoPreview,
      comment: comment.trim(),
      location: location.trim(),
      dayId: selectedDayId || undefined,
    });
    setPhotoPreview("");
    setComment("");
    setLocation("");
    setSelectedDayId("");
    setAddModalOpen(false);
  }

  // 日付フォーマット
  function formatDate(iso: string) {
    try {
      const d = new Date(iso);
      return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
    } catch {
      return iso;
    }
  }

  return (
    <div style={{ padding: "12px 14px", maxWidth: 600, margin: "0 auto" }}>

      {/* ヘッダー: 旅行完了トグル */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>
            {isCompleted ? "🎉 旅の思い出" : "📸 思い出を記録"}
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
            {isCompleted ? "旅行完了 • 写真とコメントを残しましょう" : "旅行中・旅行後に思い出を記録できます"}
          </div>
        </div>
        <button
          onClick={onToggleCompleted}
          style={{
            background: isCompleted ? "#dcfce7" : "#f1f5f9",
            border: `1px solid ${isCompleted ? "#bbf7d0" : "#e2e8f0"}`,
            borderRadius: 20,
            color: isCompleted ? "#166534" : "#64748b",
            padding: "5px 12px",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {isCompleted ? "✅ 旅行完了" : "旅行完了にする"}
        </button>
      </div>

      {/* 日程フィルター */}
      {trip.days.length > 0 && (
        <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 12, paddingBottom: 4, scrollbarWidth: "none" }}>
          <button
            onClick={() => setFilterDayId("all")}
            style={{
              background: filterDayId === "all" ? "#1e293b" : "#f1f5f9",
              border: "none",
              borderRadius: 20,
              color: filterDayId === "all" ? "#fff" : "#64748b",
              padding: "4px 12px",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >すべて</button>
          {trip.days.map((d, i) => (
            <button
              key={d.id}
              onClick={() => setFilterDayId(d.id)}
              style={{
                background: filterDayId === d.id ? "#1e293b" : "#f1f5f9",
                border: "none",
                borderRadius: 20,
                color: filterDayId === d.id ? "#fff" : "#64748b",
                padding: "4px 12px",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >{getDayLabel(d, i)}</button>
          ))}
        </div>
      )}

      {/* 思い出グリッド */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📷</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>思い出がまだありません</div>
          <div style={{ fontSize: 12, lineHeight: 1.6 }}>
            「＋ 思い出を追加」ボタンから<br />写真やコメントを記録しましょう
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 16 }}>
          {filtered.map((mem) => {
            const dayInfo = mem.dayId ? trip.days.find(d => d.id === mem.dayId) : null;
            const dayIdx = dayInfo ? trip.days.indexOf(dayInfo) : -1;
            return (
              <div
                key={mem.id}
                style={{
                  background: "#fff",
                  borderRadius: 12,
                  overflow: "hidden",
                  boxShadow: "0 2px 8px rgba(0,0,0,.08)",
                  border: "1px solid #f1f5f9",
                  position: "relative",
                }}
              >
                {/* 写真 */}
                {mem.photoUrl ? (
                  <div
                    onClick={() => setLightboxUrl(mem.photoUrl)}
                    style={{ cursor: "pointer" }}
                  >
                    <img
                      src={mem.photoUrl}
                      alt="思い出"
                      style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", display: "block" }}
                    />
                  </div>
                ) : (
                  <div style={{ width: "100%", aspectRatio: "4/3", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>
                    💬
                  </div>
                )}

                {/* コンテンツ */}
                <div style={{ padding: "8px 10px" }}>
                  {/* 日程バッジ */}
                  {dayInfo && (
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#3b82f6", marginBottom: 4 }}>
                      {getDayLabel(dayInfo, dayIdx)}
                    </div>
                  )}
                  {/* コメント */}
                  {mem.comment && (
                    <div style={{ fontSize: 12, color: "#1e293b", lineHeight: 1.5, marginBottom: 4 }}>
                      {mem.comment}
                    </div>
                  )}
                  {/* 場所 */}
                  {mem.location && (
                    <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>
                      📍 {mem.location}
                    </div>
                  )}
                  {/* 日時 */}
                  <div style={{ fontSize: 10, color: "#94a3b8" }}>
                    {formatDate(mem.createdAt)}
                  </div>
                </div>

                {/* 削除ボタン */}
                <button
                  onClick={() => {
                    if (confirm("この思い出を削除しますか？")) onDeleteMemory(mem.id);
                  }}
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                    background: "rgba(0,0,0,.5)",
                    border: "none",
                    borderRadius: "50%",
                    width: 22,
                    height: 22,
                    color: "#fff",
                    cursor: "pointer",
                    fontSize: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    lineHeight: 1,
                  }}
                >×</button>
              </div>
            );
          })}
        </div>
      )}

      {/* 追加ボタン */}
      <button
        onClick={() => setAddModalOpen(true)}
        style={{
          width: "100%",
          background: "linear-gradient(135deg,#f97316,#ec4899)",
          border: "none",
          borderRadius: 12,
          color: "#fff",
          padding: "13px",
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
          boxShadow: "0 4px 14px rgba(249,115,22,.3)",
        }}
      >
        📸 思い出を追加
      </button>

      {/* ===== 追加モーダル ===== */}
      {addModalOpen && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 400, padding: "0 0 0 0" }}
          onClick={e => e.target === e.currentTarget && setAddModalOpen(false)}
        >
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 500, maxHeight: "90vh", overflowY: "auto", padding: "20px 18px 30px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontWeight: 800, fontSize: 15, color: "#0f172a" }}>📸 思い出を追加</span>
              <button onClick={() => setAddModalOpen(false)} style={{ background: "none", border: "none", fontSize: 20, color: "#94a3b8", cursor: "pointer" }}>×</button>
            </div>

            {/* 写真選択 */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>写真（任意）</div>
              {photoPreview ? (
                <div style={{ position: "relative" }}>
                  <img src={photoPreview} alt="プレビュー" style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 10 }} />
                  <button
                    onClick={() => setPhotoPreview("")}
                    style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,.5)", border: "none", borderRadius: "50%", width: 24, height: 24, color: "#fff", cursor: "pointer", fontSize: 14 }}
                  >×</button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{ border: "2px dashed #e2e8f0", borderRadius: 10, padding: "24px", textAlign: "center", cursor: "pointer", color: "#94a3b8" }}
                >
                  <div style={{ fontSize: 28, marginBottom: 6 }}>📷</div>
                  <div style={{ fontSize: 12 }}>タップして写真を選択</div>
                  <div style={{ fontSize: 10, marginTop: 2 }}>5MB以下のJPG/PNG</div>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
            </div>

            {/* コメント */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>コメント</div>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="この瞬間の気持ちや感想を書いてください..."
                rows={3}
                style={{ width: "100%", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, color: "#1e293b", fontSize: 13, padding: "9px 12px", outline: "none", resize: "vertical", boxSizing: "border-box" }}
              />
            </div>

            {/* 場所 */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>場所（任意）</div>
              <input
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="例: 嵐山 竹林の道"
                style={{ width: "100%", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, color: "#1e293b", fontSize: 13, padding: "9px 12px", outline: "none", boxSizing: "border-box" }}
              />
            </div>

            {/* 日程選択 */}
            {trip.days.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>日程（任意）</div>
                <select
                  value={selectedDayId}
                  onChange={e => setSelectedDayId(e.target.value)}
                  style={{ width: "100%", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, color: "#1e293b", fontSize: 13, padding: "9px 12px", outline: "none", boxSizing: "border-box" }}
                >
                  <option value="">日程を選択しない</option>
                  {trip.days.map((d, i) => (
                    <option key={d.id} value={d.id}>{getDayLabel(d, i)}</option>
                  ))}
                </select>
              </div>
            )}

            {/* 追加ボタン */}
            <button
              onClick={handleAdd}
              disabled={!photoPreview && !comment.trim()}
              style={{
                width: "100%",
                background: (photoPreview || comment.trim()) ? "linear-gradient(135deg,#f97316,#ec4899)" : "#f1f5f9",
                border: "none",
                borderRadius: 10,
                color: (photoPreview || comment.trim()) ? "#fff" : "#94a3b8",
                padding: "12px",
                fontSize: 14,
                fontWeight: 700,
                cursor: (photoPreview || comment.trim()) ? "pointer" : "not-allowed",
              }}
            >
              思い出を保存
            </button>
          </div>
        </div>
      )}

      {/* ===== ライトボックス ===== */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.9)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500, padding: 16 }}
        >
          <img
            src={lightboxUrl}
            alt="思い出"
            style={{ maxWidth: "100%", maxHeight: "90vh", objectFit: "contain", borderRadius: 8 }}
          />
          <button
            onClick={() => setLightboxUrl(null)}
            style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,.2)", border: "none", borderRadius: "50%", width: 36, height: 36, color: "#fff", cursor: "pointer", fontSize: 18 }}
          >×</button>
        </div>
      )}
    </div>
  );
}
