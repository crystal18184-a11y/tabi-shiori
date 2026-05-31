// 旅のしおり - 予定追加/編集モーダル（Tailwind CSS化・④useEvtFormフック使用）
import { useState } from "react";
import { CATS, dsub } from "@/lib/store";
import type { Trip, TabiEvent } from "@/lib/store";
import { useEvtForm } from "@/hooks/useEvtForm";

interface Props {
  trip: Trip | undefined;
  editEvtId: string | null;
  editFromDay: string;
  initialSpot?: import("@/lib/store").PoolSpot | null;
  clientId: string;
  onClose: () => void;
  onSave: (data: Omit<TabiEvent, "id">, toDid: string) => void;
}

export default function EvtModal({ trip, editEvtId, editFromDay, initialSpot, clientId, onClose, onSave }: Props) {
  const existing = editEvtId ? trip?.days.flatMap(d => d.events).find(e => e.id === editEvtId) : null;
  const [toDid, setToDid] = useState(editFromDay);

  const form = useEvtForm({
    existing,
    initialSpot,
    tripDestination: trip?.destination,
    clientId,
  });

  function handleSave() {
    if (!form.title.trim()) { alert("タイトルを入力してください"); return; }
    onSave({
      time: form.time,
      category: form.category,
      title: form.title.trim(),
      location: form.location,
      url: form.url,
      lat: form.lat,
      lng: form.lng,
      memo: form.memo,
      photo: form.photo || form.photoPreview,
      reservationNo: form.reservationNo,
      attachments: form.attachments,
    }, toDid);
  }

  return (
    <div
      role="dialog" aria-modal="true" aria-labelledby="evt-modal-title"
      className="fixed inset-0 bg-black/45 flex items-center justify-center z-[300] p-3"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        {/* ヘッダー */}
        <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100 flex-shrink-0">
          <h2 id="evt-modal-title" className="font-bold text-sm text-slate-900">
            {editEvtId ? "予定を編集" : "予定を追加"}
          </h2>
          <div className="flex gap-2">
            <button onClick={onClose} className="bg-slate-100 border-none rounded-lg text-slate-500 px-3 py-1.5 text-xs cursor-pointer hover:bg-slate-200 transition-colors">キャンセル</button>
            <button onClick={handleSave} className="bg-gradient-to-r from-blue-500 to-indigo-500 border-none rounded-lg text-white px-4 py-1.5 text-xs font-bold cursor-pointer hover:from-blue-600 hover:to-indigo-600 transition-all">保存する</button>
          </div>
        </div>

        {/* フォーム */}
        <div className="p-4 grid grid-cols-2 gap-3">
          {/* 日程選択 */}
          <div className="col-span-2 flex flex-col gap-1">
            <label htmlFor="evt-day" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">日程</label>
            <select id="evt-day" value={toDid} onChange={e => setToDid(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg text-sm px-2.5 py-2 outline-none cursor-pointer focus:border-blue-300 transition-colors">
              {trip?.days.map((d, i) => <option key={d.id} value={d.id}>Day {i + 1}{d.date ? ` (${dsub(d.date)})` : ""}</option>)}
            </select>
          </div>

          {/* 時間・カテゴリ */}
          <div className="flex flex-col gap-1">
            <label htmlFor="evt-time" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">時間</label>
            <input id="evt-time" type="time" value={form.time} onChange={e => form.setTime(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg text-sm px-2.5 py-2 outline-none focus:border-blue-300 transition-colors" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="evt-category" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">カテゴリ</label>
            <select id="evt-category" value={form.category} onChange={e => form.setCategory(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg text-sm px-2.5 py-2 outline-none cursor-pointer focus:border-blue-300 transition-colors">
              {Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v.i} {k}</option>)}
            </select>
          </div>

          {/* タイトル（AI候補付き） */}
          <div className="col-span-2 flex flex-col gap-1 relative">
            <label htmlFor="evt-title" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              場所名 *
              {form.aiSearching && <span className="font-normal text-blue-500 ml-1.5">🔍 検索中...</span>}
            </label>
            <input
              id="evt-title"
              value={form.title}
              onChange={e => form.handleTitleChange(e.target.value)}
              onFocus={() => form.placeCandidates.length > 0 && form.setShowCandidates(true)}
              placeholder="例：あぢもり（入力すると場所候補が表示されます）"
              autoComplete="off"
              className="bg-slate-50 border border-slate-200 rounded-lg text-sm px-2.5 py-2 outline-none focus:border-blue-300 transition-colors"
            />
            {/* AI候補ドロップダウン */}
            {form.showCandidates && form.placeCandidates.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-[400] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden mt-0.5">
                <div className="px-2.5 py-1.5 text-[10px] font-bold text-slate-500 border-b border-slate-100">📍 場所候補（クリックで選択）</div>
                {form.placeCandidates.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => form.applyCandidate(p)}
                    className="w-full text-left px-3 py-2 border-b border-slate-50 last:border-0 cursor-pointer hover:bg-slate-50 flex flex-col gap-0.5 transition-colors bg-transparent"
                  >
                    <span className="text-sm font-bold text-slate-900">{p.name}</span>
                    <span className="text-[10px] text-slate-500">📍 {p.address}</span>
                    <span className="text-[10px] text-blue-500">{p.category}</span>
                  </button>
                ))}
                <button onClick={() => form.setShowCandidates(false)} className="w-full px-3 py-1.5 text-[10px] text-slate-400 cursor-pointer text-center bg-transparent border-none hover:bg-slate-50 transition-colors">閉じる</button>
              </div>
            )}
          </div>

          {/* Google Maps URL */}
          <div className="col-span-2 flex flex-col gap-1">
            <label htmlFor="evt-url" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Google Maps URL <span className="font-normal text-slate-400">（短縮URL maps.app.goo.gl も対応）</span>
            </label>
            <div className="flex gap-1.5">
              <input
                id="evt-url"
                value={form.url}
                onChange={e => { form.setUrl(e.target.value); form.handleUrlGeocode(e.target.value); }}
                placeholder="https://maps.app.goo.gl/..."
                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg text-sm px-2.5 py-2 outline-none focus:border-blue-300 transition-colors"
              />
              <button
                onClick={() => form.handleUrlGeocode(form.url)}
                disabled={form.geoLoading}
                aria-label="URLを解析して住所・座標を取得"
                className="bg-blue-50 border border-blue-200 rounded-lg text-blue-600 px-2.5 py-2 text-xs cursor-pointer whitespace-nowrap flex-shrink-0 hover:bg-blue-100 transition-colors disabled:opacity-50"
              >{form.geoLoading ? "⏳" : "🔍"} URL解析</button>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">① GoogleマップでURLをコピー → ② 上に貼り付け → ③「🔍 URL解析」で自動取得</p>
          </div>

          {/* 場所・住所 */}
          <div className="col-span-2 flex flex-col gap-1">
            <label htmlFor="evt-location" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              住所 <span className="font-normal text-slate-400">（URL解析後に自動入力されます）</span>
            </label>
            <div className="flex gap-1.5">
              <input
                id="evt-location"
                value={form.location}
                onChange={e => form.setLocation(e.target.value)}
                placeholder="例：鹿児島県鹿児島市千日町１３－２１（自動入力されます）"
                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg text-sm px-2.5 py-2 outline-none focus:border-blue-300 transition-colors"
              />
              <button
                onClick={form.handleGeocode}
                disabled={form.geoLoading}
                aria-label="住所から座標を取得"
                className="bg-slate-100 border border-slate-200 rounded-lg text-slate-500 px-2.5 py-2 text-xs cursor-pointer whitespace-nowrap flex-shrink-0 hover:bg-slate-200 transition-colors disabled:opacity-50"
              >{form.geoLoading ? "⏳" : "📍"} 座標取得</button>
            </div>
          </div>

          {/* 移動時間計算ボタン */}
          {trip && toDid && (() => {
            const day = trip.days.find(d => d.id === toDid);
            const prevEvent = day?.events?.[day.events.length - 1];
            return prevEvent && prevEvent.lat && prevEvent.lng ? (
              <div className="col-span-2">
                <button
                  onClick={() => form.handleCalcTravelTime(prevEvent.lat, prevEvent.lng)}
                  disabled={form.travelLoading}
                  aria-label="前の予定からの移動時間を計算"
                  className="w-full bg-amber-50 border border-amber-200 rounded-lg text-amber-600 px-3 py-2 text-xs font-bold cursor-pointer hover:bg-amber-100 transition-colors disabled:opacity-50"
                >
                  {form.travelLoading ? "⏳" : "🚆"} 移動時間を計算（{prevEvent.title}から）
                </button>
              </div>
            ) : null;
          })()}

          {/* ステータス */}
          {form.geoStatus && (
            <div role="status" className="col-span-2">
              <p className={`text-[11px] px-2.5 py-1.5 rounded-lg leading-relaxed ${form.geoStatus.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
                {form.geoStatus.msg}
              </p>
            </div>
          )}

          {/* 緯度・経度 */}
          <div className="flex flex-col gap-1">
            <label htmlFor="evt-lat" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">緯度（自動入力）</label>
            <input id="evt-lat" value={form.lat} onChange={e => form.setLat(e.target.value)} placeholder="35.71" className="bg-slate-50 border border-slate-200 rounded-lg text-sm px-2.5 py-2 outline-none focus:border-blue-300 transition-colors" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="evt-lng" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">経度（自動入力）</label>
            <input id="evt-lng" value={form.lng} onChange={e => form.setLng(e.target.value)} placeholder="139.79" className="bg-slate-50 border border-slate-200 rounded-lg text-sm px-2.5 py-2 outline-none focus:border-blue-300 transition-colors" />
          </div>

          {/* 予約番号 */}
          <div className="col-span-2 flex flex-col gap-1">
            <label htmlFor="evt-resno" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">予約番号</label>
            <input id="evt-resno" value={form.reservationNo} onChange={e => form.setReservationNo(e.target.value)} placeholder="例：ABC-12345678" className="bg-slate-50 border border-slate-200 rounded-lg text-sm px-2.5 py-2 outline-none font-mono focus:border-blue-300 transition-colors" />
          </div>

          {/* メモ */}
          <div className="col-span-2 flex flex-col gap-1">
            <label htmlFor="evt-memo" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">メモ</label>
            <textarea id="evt-memo" value={form.memo} onChange={e => form.setMemo(e.target.value)} placeholder="メモ..." className="bg-slate-50 border border-slate-200 rounded-lg text-sm px-2.5 py-2 outline-none h-16 resize-y focus:border-blue-300 transition-colors" />
          </div>

          {/* 写真 */}
          <div className="col-span-2 flex flex-col gap-1">
            <label htmlFor="evt-photo-url" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">写真URL</label>
            <div className="flex gap-1.5">
              <input
                id="evt-photo-url"
                value={form.photo}
                onChange={e => form.setUrl(e.target.value)}
                placeholder="画像URL"
                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg text-sm px-2.5 py-2 outline-none focus:border-blue-300 transition-colors"
              />
              <button
                onClick={() => document.getElementById("evt-photo-file")?.click()}
                aria-label="ファイルから写真を選択"
                className="bg-slate-100 border border-slate-200 rounded-lg text-slate-500 px-2.5 py-2 text-xs cursor-pointer flex-shrink-0 hover:bg-slate-200 transition-colors"
              >📁</button>
              <input type="file" id="evt-photo-file" accept="image/*" className="hidden" onChange={form.handlePhotoChange} />
            </div>
            {form.photoPreview && (
              <img src={form.photoPreview} alt="写真プレビュー" className="w-full max-h-24 object-cover rounded-lg mt-1" />
            )}
          </div>
        </div>
        <div className="h-3.5" />
      </div>
    </div>
  );
}
