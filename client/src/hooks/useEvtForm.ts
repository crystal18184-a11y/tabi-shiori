// ④ EvtModalのフォーム状態・ジオコーディングロジックを分離したカスタムフック
import { useState, useRef, useCallback } from "react";
import { geocodeByName } from "@/lib/geocode";
import { trpc } from "@/lib/trpc";
import type { TabiEvent, PoolSpot } from "@/lib/store";

interface UseEvtFormOptions {
  existing: TabiEvent | null | undefined;
  initialSpot?: PoolSpot | null;
  tripDestination?: string;
  clientId: string;
}

export function useEvtForm({ existing, initialSpot, tripDestination, clientId }: UseEvtFormOptions) {
  const [time, setTime] = useState(existing?.time || "09:00");
  const [category, setCategory] = useState(existing?.category || (initialSpot ? "観光" : "観光"));
  const [title, setTitle] = useState(existing?.title || initialSpot?.name || "");
  const [location, setLocation] = useState(existing?.location || initialSpot?.location || "");
  const [url, setUrl] = useState(existing?.url || initialSpot?.url || "");
  const [lat, setLat] = useState(existing?.lat || initialSpot?.lat || "");
  const [lng, setLng] = useState(existing?.lng || initialSpot?.lng || "");
  const [memo, setMemo] = useState(existing?.memo || initialSpot?.memo || "");
  const [photo, setPhoto] = useState(existing?.photo?.startsWith("data:") ? "" : (existing?.photo || ""));
  const [photoPreview, setPhotoPreview] = useState(existing?.photo || "");
  const [reservationNo, setReservationNo] = useState(existing?.reservationNo || "");
  const [attachments, setAttachments] = useState<string[]>(existing?.attachments || []);
  const [geoStatus, setGeoStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);

  // AI場所候補
  const [placeCandidates, setPlaceCandidates] = useState<{ name: string; address: string; category: string; mapsUrl: string }[]>([]);
  const [aiSearching, setAiSearching] = useState(false);
  const [showCandidates, setShowCandidates] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resolveMapUrl = trpc.geo.resolveMapUrl.useMutation();
  const searchPlaces = trpc.places.search.useMutation();
  const uploadPhoto = trpc.photo.upload.useMutation();
  const calcTravelTime = trpc.travel.calcTime.useMutation();

  // 移動時間計算状態
  const [travelTime, setTravelTime] = useState<{ driving?: string; walking?: string } | null>(null);
  const [travelLoading, setTravelLoading] = useState(false);

  // Google Maps URL解析
  const handleUrlGeocode = useCallback(async (inputUrl: string) => {
    if (!inputUrl.trim()) return;
    const isGmaps = inputUrl.includes("google.com/maps") || inputUrl.includes("maps.app.goo.gl") || inputUrl.includes("goo.gl/maps");
    if (!isGmaps) return;
    setGeoLoading(true);
    setGeoStatus({ msg: "🔍 URLを解析中...", ok: true });
    try {
      const res = await resolveMapUrl.mutateAsync({ url: inputUrl });
      if (res.lat && res.lng) {
        setLat(String(res.lat));
        setLng(String(res.lng));
        if (res.address && !location) setLocation(res.address);
        if (res.placeName && !title) setTitle(res.placeName);
        setGeoStatus({ msg: "✅ 座標を取得しました", ok: true });
      } else if (res.address) {
        setLocation(res.address);
        setGeoStatus({ msg: "📍 住所を取得（座標は別途取得）", ok: true });
      } else {
        setGeoStatus({ msg: "⚠️ URLから情報を取得できませんでした", ok: false });
      }
    } catch {
      setGeoStatus({ msg: "❌ URL解析に失敗しました", ok: false });
    } finally {
      setGeoLoading(false);
    }
  }, [location, title, resolveMapUrl]);

  // 住所→座標変換
  const handleGeocode = useCallback(async () => {
    if (!location.trim()) return;
    setGeoLoading(true);
    setGeoStatus({ msg: "📡 座標を検索中...", ok: true });
    try {
      const res = await geocodeByName(location);
      if (res) {
        setLat(res.lat);
        setLng(res.lng);
        setGeoStatus({ msg: `✅ 座標を取得 (${parseFloat(res.lat).toFixed(4)}, ${parseFloat(res.lng).toFixed(4)})`, ok: true });
      } else {
        setGeoStatus({ msg: "⚠️ 座標が見つかりませんでした", ok: false });
      }
    } catch {
      setGeoStatus({ msg: "❌ ジオコーディングに失敗しました", ok: false });
    } finally {
      setGeoLoading(false);
    }
  }, [location]);

  // AI場所候補検索（デバウンス付き）
  const handleTitleChange = useCallback((value: string) => {
    setTitle(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (value.length < 2) { setPlaceCandidates([]); setShowCandidates(false); return; }
    searchTimerRef.current = setTimeout(async () => {
      setAiSearching(true);
      try {
        const res = await searchPlaces.mutateAsync({ query: value, destination: tripDestination });
        if (res.places?.length) { setPlaceCandidates(res.places); setShowCandidates(true); }
      } catch {
        // AI検索失敗は静かに無視
      } finally {
        setAiSearching(false);
      }
    }, 800);
  }, [searchPlaces, tripDestination]);

  // 候補を選択（Nominatimが返すlat/lngを直接セット）
  const applyCandidate = useCallback((c: { name: string; address: string; category: string; mapsUrl: string; lat?: string; lng?: string }) => {
    setTitle(c.name);
    setLocation(c.address);
    setCategory(c.category);
    setUrl(c.mapsUrl);
    setShowCandidates(false);
    setPlaceCandidates([]);
    if (c.lat && c.lng) {
      // Nominatimから取得した実座標をそのまま使用（AIによる生成ではない）
      setLat(parseFloat(c.lat).toFixed(6));
      setLng(parseFloat(c.lng).toFixed(6));
      setGeoStatus({ msg: `✅ 座標を取得しました（${parseFloat(c.lat).toFixed(4)}, ${parseFloat(c.lng).toFixed(4)}）`, ok: true });
    } else {
      setGeoStatus({ msg: "📍 住所を設定しました。「座標取得」ボタンで座標を確認できます", ok: true });
    }
  }, []);

  // 画像アップロード
  const handlePhotoChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const b64 = ev.target?.result as string;
      setPhotoPreview(b64);
      try {
        const res = await uploadPhoto.mutateAsync({ base64: b64, clientId, filename: file.name });
        setPhoto(res.url);
        setGeoStatus({ msg: "✅ 写真をアップロードしました", ok: true });
      } catch {
        setPhoto(b64); // フォールバック: base64をそのまま使用
      }
    };
    reader.readAsDataURL(file);
  }, [clientId, uploadPhoto]);

  // 移動時間計算（前の予定から現在の予定への移動時間）
  // ※ transitモードはプロキシAPIで未対応のため、driving/walkingのみ計算
  const handleCalcTravelTime = useCallback(async (prevEventLat?: string, prevEventLng?: string) => {
    if (!prevEventLat || !prevEventLng || !lat || !lng) {
      setGeoStatus({ msg: "前の予定と現在の予定の座標が必要です", ok: false });
      return;
    }
    setTravelLoading(true);
    setGeoStatus({ msg: "🚗 移動時間を計算中...", ok: true });
    try {
      const origin = `${prevEventLat},${prevEventLng}`;
      const destination = `${lat},${lng}`;
      // driving と walking の2モードで計算
      const modes = ['driving', 'walking'] as const;
      const results: Record<string, { duration: string; distance: string }> = {};
      for (const mode of modes) {
        try {
          const res = await calcTravelTime.mutateAsync({ origin, destination, mode });
          if (res.ok) results[mode] = { duration: res.duration, distance: res.distance };
        } catch (err) {
          console.error(`[travel.calcTime] ${mode} failed:`, err);
        }
      }
      if (Object.keys(results).length > 0) {
        setTravelTime({
          driving: results.driving?.duration,
          walking: results.walking?.duration,
        });
        const summary = [
          results.driving ? `🚗 ${results.driving.duration}` : null,
          results.walking ? `🚶 ${results.walking.duration}` : null,
        ].filter(Boolean).join(" / ");
        setGeoStatus({ msg: `✅ 移動時間: ${summary}`, ok: true });
      } else {
        setGeoStatus({ msg: "❌ 移動時間を計算できませんでした", ok: false });
      }
    } catch (err) {
      console.error("[handleCalcTravelTime]", err);
      setGeoStatus({ msg: "❌ 移動時間計算に失敗しました", ok: false });
    } finally {
      setTravelLoading(false);
    }
  }, [lat, lng, calcTravelTime]);

  // 添付ファイルアップロード
  const handleAttachmentChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const b64 = ev.target?.result as string;
        try {
          const res = await uploadPhoto.mutateAsync({ base64: b64, clientId, filename: file.name });
          setAttachments(prev => [...prev, res.url]);
        } catch {
          setAttachments(prev => [...prev, b64]);
        }
      };
      reader.readAsDataURL(file);
    }
  }, [clientId, uploadPhoto]);

  return {
    // フォーム値
    time, setTime,
    category, setCategory,
    title,
    location, setLocation,
    url, setUrl,
    lat, setLat,
    lng, setLng,
    memo, setMemo,
    photo,
    photoPreview,
    reservationNo, setReservationNo,
    attachments, setAttachments,
    geoStatus, geoLoading,
    placeCandidates, aiSearching, showCandidates, setShowCandidates,
    // ハンドラ
    handleTitleChange,
    handleUrlGeocode,
    handleGeocode,
    applyCandidate,
    handlePhotoChange,
    handleAttachmentChange,
    handleCalcTravelTime,
    travelTime, travelLoading,
  };
}
