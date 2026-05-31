// 旅のしおり - Leafletインタラクティブ地図コンポーネント
// - シンプルなUI（コントロール最小化）
// - focusEventId で特定マーカーにフォーカス
// - ルート線表示: 日程順にスポットを線でつなぐ
import { useEffect, useRef } from "react";
import { DC, CATS } from "@/lib/store";
import type { Trip } from "@/lib/store";

declare const L: any;

interface Props {
  trip: Trip | undefined;
  mapMode: "all" | "day";
  currentDid: string;
  focusEventId?: string | null;
  onFocusDone?: () => void;
  showRoute?: boolean;
}

export default function LeafletMap({ trip, mapMode, currentDid, focusEventId, onFocusDone, showRoute = true }: Props) {
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const polylinesRef = useRef<any[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // 地図初期化
  useEffect(() => {
    if (!containerRef.current || typeof L === "undefined") return;
    if (!mapRef.current) {
      mapRef.current = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: false,
        scrollWheelZoom: true,
      });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
        subdomains: "abcd",
      }).addTo(mapRef.current);
      L.control.attribution({ position: "bottomright", prefix: false }).addTo(mapRef.current);
    }
  }, []);

  // マーカー＆ルート線更新
  useEffect(() => {
    if (!mapRef.current || typeof L === "undefined" || !trip) return;

    // 既存マーカーをクリア
    markersRef.current.forEach(m => mapRef.current.removeLayer(m));
    markersRef.current.clear();

    // 既存ルート線をクリア
    polylinesRef.current.forEach(p => mapRef.current.removeLayer(p));
    polylinesRef.current = [];

    const daysToShow = mapMode === "all" ? trip.days : trip.days.filter(d => d.id === currentDid);
    const pts: { e: any; dayIdx: number; seq: number; lat: number; lng: number }[] = [];

    daysToShow.forEach(d => {
      const idx = trip.days.indexOf(d);
      (d.events || []).filter(e => e.lat && e.lng).forEach((e, j) => {
        const la = parseFloat(e.lat!), lo = parseFloat(e.lng!);
        if (!isNaN(la) && !isNaN(lo)) pts.push({ e, dayIdx: idx, seq: j, lat: la, lng: lo });
      });
    });

    // poolスポットのマーカーを追加（★アイコン、グレー色）
    const poolMarkers: any[] = [];
    daysToShow.forEach(d => {
      (d.pool || []).filter((p: any) => p.lat && p.lng).forEach((p: any) => {
        const la = parseFloat(p.lat), lo = parseFloat(p.lng);
        if (isNaN(la) || isNaN(lo)) return;
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:28px;height:28px;border-radius:50%;background:#f59e0b;border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:13px;cursor:pointer;">★</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
          popupAnchor: [0, -18],
        });
        const marker = L.marker([la, lo], { icon }).addTo(mapRef.current);
        marker.bindPopup(`
          <div style="font-family:'Noto Sans JP',sans-serif;min-width:140px;max-width:210px">
            <div style="font-size:10px;font-weight:800;color:#f59e0b;margin-bottom:3px">★ 行きたいスポット</div>
            <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:4px;line-height:1.4">${escHtml(p.name)}</div>
            ${p.location ? `<div style="font-size:11px;color:#64748b">📍 ${escHtml(p.location)}</div>` : ""}
            ${p.memo ? `<div style="font-size:11px;color:#64748b;margin-top:2px">${escHtml(p.memo)}</div>` : ""}
          </div>
        `, { maxWidth: 230 });
        markersRef.current.set(`pool_${p.id}`, marker);
        poolMarkers.push(marker);
      });
    });

    if (pts.length > 0) {
      // マーカーを追加
      pts.forEach(p => {
        const col = DC[p.dayIdx % DC.length];
        const num = p.seq + 1;
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:30px;height:30px;border-radius:50%;background:${col};border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff;font-family:'Noto Sans JP',sans-serif;cursor:pointer;">${num}</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
          popupAnchor: [0, -18],
        });
        const c = CATS[p.e.category] || CATS["その他"];
        const marker = L.marker([p.lat, p.lng], { icon }).addTo(mapRef.current);
        marker.bindPopup(`
          <div style="font-family:'Noto Sans JP',sans-serif;min-width:150px;max-width:220px">
            <div style="font-size:11px;font-weight:800;color:${col};margin-bottom:3px;letter-spacing:.03em">Day ${p.dayIdx + 1}</div>
            <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:4px;line-height:1.4">${escHtml(p.e.title)}</div>
            ${p.e.time ? `<div style="font-size:11px;color:#64748b;margin-bottom:1px">🕐 ${escHtml(p.e.time)}</div>` : ""}
            ${p.e.location ? `<div style="font-size:11px;color:#64748b;margin-bottom:4px">📍 ${escHtml(p.e.location)}</div>` : ""}
            <span style="font-size:10px;padding:2px 8px;background:${col}22;color:${col};border-radius:10px;font-weight:700">${c.i} ${escHtml(p.e.category)}</span>
          </div>
        `, { maxWidth: 240 });
        markersRef.current.set(p.e.id, marker);
      });

      // ルート線を描画（日程ごとに色分け）
      if (showRoute) {
        if (mapMode === "all") {
          // 全日程モード: 日程ごとにグループ化して線を引く
          const dayGroups = new Map<number, { lat: number; lng: number }[]>();
          pts.forEach(p => {
            if (!dayGroups.has(p.dayIdx)) dayGroups.set(p.dayIdx, []);
            dayGroups.get(p.dayIdx)!.push({ lat: p.lat, lng: p.lng });
          });
          dayGroups.forEach((coords, dayIdx) => {
            if (coords.length < 2) return;
            const col = DC[dayIdx % DC.length];
            const latlngs = coords.map(c => [c.lat, c.lng]);
            const polyline = L.polyline(latlngs, {
              color: col,
              weight: 2.5,
              opacity: 0.6,
              dashArray: "6, 4",
              lineCap: "round",
              lineJoin: "round",
            }).addTo(mapRef.current);
            polylinesRef.current.push(polyline);
          });
        } else {
          // この日モード: 単一の線
          if (pts.length >= 2) {
            const col = DC[pts[0].dayIdx % DC.length];
            const latlngs = pts.map(p => [p.lat, p.lng]);
            const polyline = L.polyline(latlngs, {
              color: col,
              weight: 3,
              opacity: 0.7,
              dashArray: "6, 4",
              lineCap: "round",
            }).addTo(mapRef.current);
            polylinesRef.current.push(polyline);
          }
        }
      }

      const group = L.featureGroup(Array.from(markersRef.current.values()));
      mapRef.current.fitBounds(group.getBounds().pad(0.18));
    } else if (poolMarkers.length > 0) {
      // eventsがなくpoolスポットのみの場合もfitBounds
      const group = L.featureGroup(poolMarkers);
      mapRef.current.fitBounds(group.getBounds().pad(0.18));
    } else {
      mapRef.current.setView([36.5, 136.0], 5);
    }
    setTimeout(() => { if (mapRef.current) mapRef.current.invalidateSize(); }, 100);
  }, [trip, mapMode, currentDid, showRoute]);

  // focusEventId が変わったらそのマーカーにフォーカス
  useEffect(() => {
    if (!focusEventId || !mapRef.current) return;
    const marker = markersRef.current.get(focusEventId);
    if (marker) {
      const latlng = marker.getLatLng();
      mapRef.current.flyTo(latlng, 15, { animate: true, duration: 0.8 });
      setTimeout(() => marker.openPopup(), 900);
      onFocusDone?.();
    }
  }, [focusEventId]);

  // タブ切替後にサイズ再計算
  useEffect(() => {
    const timer = setTimeout(() => { if (mapRef.current) mapRef.current.invalidateSize(); }, 150);
    return () => clearTimeout(timer);
  });

  return (
    <div ref={containerRef} style={{ flex: 1, position: "relative", overflow: "hidden", background: "#e8f0f8" }} />
  );
}

function escHtml(s: string) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
