// Google Maps URL から座標を解析するユーティリティ

/**
 * Google Maps URLから座標を抽出する
 * 対応パターン:
 * - https://maps.app.goo.gl/... (短縮URL → サーバー経由でリダイレクト先を取得)
 * - https://www.google.com/maps/@lat,lng,...
 * - https://www.google.com/maps/place/.../@lat,lng,...
 * - https://www.google.com/maps?q=lat,lng
 * - https://www.google.com/maps/search/.../@lat,lng,...
 * - ll=lat,lng パラメータ
 */
export async function extractCoordsFromUrl(url: string): Promise<{ lat: string; lng: string; source: string } | null> {
  if (!url) return null;

  // パターン1: @lat,lng を含むURL（最も一般的）
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) return { lat: atMatch[1], lng: atMatch[2], source: "url_at" };

  // パターン2: ?q=lat,lng
  const qMatch = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (qMatch) return { lat: qMatch[1], lng: qMatch[2], source: "url_q" };

  // パターン3: ll=lat,lng
  const llMatch = url.match(/ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (llMatch) return { lat: llMatch[1], lng: llMatch[2], source: "url_ll" };

  // パターン4: /place/name/@lat,lng
  const placeMatch = url.match(/\/place\/[^/]+\/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (placeMatch) return { lat: placeMatch[1], lng: placeMatch[2], source: "url_place" };

  // パターン5: maps.app.goo.gl 短縮URL → サーバー経由でリダイレクト先を取得
  if (url.includes("maps.app.goo.gl") || url.includes("goo.gl/maps")) {
    try {
      const res = await fetch(`/api/trpc/system.resolveUrl?input=${encodeURIComponent(JSON.stringify({ url }))}`, {
        credentials: "include",
      });
      if (res.ok) {
        const json = await res.json();
        const resolved = json?.result?.data?.resolvedUrl as string;
        if (resolved) {
          const m = resolved.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
          if (m) return { lat: m[1], lng: m[2], source: "short_url" };
        }
      }
    } catch {}
  }

  return null;
}

/**
 * 場所名・住所からサーバーサイド経由でNominatimで座標を取得する
 * 全角数字→半角変換・番地なしフォールバックに対応（サーバーサイドで処理）
 */
export async function geocodeByName(query: string): Promise<{ lat: string; lng: string; displayName: string } | null> {
  if (!query.trim()) return null;

  try {
    // サーバーサイドAPIを経由してNominatimを呼ぶ
    // （User-Agentヘッダー・全角変換・フォールバックをサーバー側で処理）
    // mutationなのでPOSTリクエストを使用
    const res = await fetch(
      `/api/trpc/geocode.byAddress`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: { address: query } }),
      }
    );
    if (res.ok) {
      const json = await res.json();
      // tRPC単一レスポンス形式
      const result = json?.result?.data?.json ?? json?.result?.data ?? json;
      if (result?.lat && result?.lng) {
        return {
          lat: result.lat,
          lng: result.lng,
          displayName: result.displayName || query,
        };
      }
    }
  } catch {}

  return null;
}
