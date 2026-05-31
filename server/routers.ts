import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { invokeLLM } from "./_core/llm";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { createSharedTrip, getSharedTrip, upsertSharedTrip, saveUserTripData, getUserTripData, createRecommendedSpot, searchRecommendedSpots } from "./db";
import { storagePut } from "./storage";
import { makeRequest, type GeocodingResult, type PlacesSearchResult } from "./_core/map.js";

// バグ2修正: Nominatim レートリミット対策 - 目的地名→座標のインメモリキャッシュ
// 同一目的地への並列リクエスト時にNominatimを1回だけ呼ぶ
const geoCache = new Map<string, { lat: number; lng: number }>();
/** テスト用: geoCacheをクリアする */
export function clearGeoCache() { geoCache.clear(); }

/**
 * 日本語住所クリーニング
 * 「〒892-0843 鹿児島県鹿児島市千日町１３－２１」→「鹿児島県鹿児島市千日町１３－２１」（番地まで含む）
 * 〒番号・店名のみ除去し、都道府県～番地までを残す
 */
function cleanJapaneseAddress(raw: string): string {
  // 先頭の+・スペースを除去（?q=パラメータの+スペース置換後に残る場合がある）
  let addr = raw.replace(/^[+\s]+/, '').trim();

  // 〒番号を除去（「〒XXX-XXXX 」形式）
  addr = addr.replace(/〒\d{3}-\d{4}[+\s]*/g, '').trim();

  // 先頭の+・スペースを再度除去（〒除去後に残る場合）
  addr = addr.replace(/^[+\s]+/, '').trim();

  // 店名等がスペース区切りで続く場合は住所部分のみ使用
  // 例: 「鹿児島県鹿児島市千日町１３－２１ 黒豚料理あぢもり」→「鹿児島県鹿児島市千日町１３－２１」
  // 都道府県から始まる住所パターンを抽出
  const addrMatch = addr.match(/^([^\u3000 \t]+(?:都|道|府|県)[^\u3000 \t]+)/);
  if (addrMatch) {
    return addrMatch[1];
  }

  // 都道府県パターンがない場合はスペースまでを住所として使用
  const spaceIdx = addr.search(/[\s\u3000]/);
  if (spaceIdx > 0) {
    return addr.slice(0, spaceIdx);
  }

  return addr;
}

/**
 * 住所文字列から施設名を抽出する
 * 例: 「鹿児島県指宿市山川福刔3292 ヘルシーランド露天風呂」→「ヘルシーランド露天風呂」
 */
function extractFacilityName(raw: string): string | null {
  // 〒番号を除去
  let s = raw.replace(/〒\d{3}-\d{4}[+\s]*/g, '').trim();
  s = s.replace(/^[+\s]+/, '').trim();

  // 都道府県から始まる住所+スペース+施設名のパターン
  const m = s.match(/^[^\u3000 \t]+(?:都|道|府|県)[^\u3000 \t]+[\u3000 \t]+(.+)$/);
  if (m) return m[1].trim();

  // 数字+スペース+施設名のパターン（住所番号後にスペースで施設名）
  const m2 = s.match(/\d+[\u3000 \t]+(.+)$/);
  if (m2) return m2[1].trim();

  return null;
}

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // 旅のしおり: 共有旅行プランAPI
  trip: router({
    /** 新しい共有コードを作成してプランを保存する */
    create: publicProcedure
      .input(z.object({ tripData: z.string() }))
      .mutation(async ({ input }) => {
        const code = await createSharedTrip(input.tripData);
        return { shareCode: code };
      }),

    /** 共有コードでプランを取得する */
    get: publicProcedure
      .input(z.object({ shareCode: z.string() }))
      .query(async ({ input }) => {
        const trip = await getSharedTrip(input.shareCode.toUpperCase());
        if (!trip) return null;
        return {
          shareCode: trip.shareCode,
          tripData: trip.tripData,
          updatedAt: trip.updatedAt,
        };
      }),

    /** 既存の共有コードのプランを更新する */
    update: publicProcedure
      .input(z.object({ shareCode: z.string(), tripData: z.string() }))
      .mutation(async ({ input }) => {
        await upsertSharedTrip(input.shareCode.toUpperCase(), input.tripData);
        return { success: true };
      }),

    /** 最終更新時刻だけ取得する（ポーリング用） */
    poll: publicProcedure
      .input(z.object({ shareCode: z.string() }))
      .query(async ({ input }) => {
        const trip = await getSharedTrip(input.shareCode.toUpperCase());
        if (!trip) return null;
        return { updatedAt: trip.updatedAt };
      }),
  }),

  // Google Maps短縮URL解決API（サーバーサイドでリダイレクト先を取得）
  geo: router({
    /** Google Maps短縮URLを解決して住所・座標を返す */
    resolveMapUrl: publicProcedure
      .input(z.object({ url: z.string() }))
      .mutation(async ({ input }) => {
        try {
          // サーバーサイドでリダイレクト先URLを取得
          let resolvedUrl: string;
          try {
            // まずfetchを試みる（タイムアウト15秒）
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000);
            const response = await fetch(input.url, {
              method: 'GET',
              redirect: 'follow',
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
              signal: controller.signal,
            });
            clearTimeout(timeout);
            resolvedUrl = response.url;
          } catch (fetchErr) {
            // fetchが失敗した場合、curlをフォールバックとして使用（Windows/Linux両対応）
            console.log('[geo.resolveMapUrl] fetch failed, trying curl fallback');
            const { execSync } = await import('child_process');
            const nullDevice = process.platform === 'win32' ? 'NUL' : '/dev/null';
            const curlResult = execSync(
              `curl -s -L -o ${nullDevice} -w "%{url_effective}" --max-time 20 "${input.url.replace(/"/g, '\\"')}"`,
              { encoding: 'utf-8', timeout: 25000 }
            ).trim();
            if (!curlResult) throw new Error('curl returned empty URL');
            resolvedUrl = curlResult;
          }
          console.log('[geo.resolveMapUrl] resolvedUrl:', resolvedUrl.slice(0, 200));

          let lat: string | null = null;
          let lng: string | null = null;
          let address: string | null = null;   // 住所（都道府県～番地）
          let placeName: string | null = null; // 施設名（タイトルに使う）

          // ヘルパー: 施設名でGoogle Maps Places Text Search
          const tryPlaceSearch = async (q: string): Promise<{ lat: string; lng: string } | null> => {
            try {
              const data = await makeRequest<PlacesSearchResult>('/maps/api/place/textsearch/json', {
                query: q, language: 'ja',
              });
              if (data.results[0]) {
                const loc = data.results[0].geometry.location;
                return { lat: String(loc.lat), lng: String(loc.lng) };
              }
            } catch (err) {
              console.warn('[geo.resolveMapUrl] place search error:', err);
            }
            return null;
          };

          // ヘルパー: 住所でGoogle Maps Geocoding API
          const tryGeocode = async (q: string): Promise<{ lat: string; lng: string } | null> => {
            try {
              const data = await makeRequest<GeocodingResult>('/maps/api/geocode/json', {
                address: q, language: 'ja', region: 'jp',
              });
              if (data.results[0]) {
                const loc = data.results[0].geometry.location;
                return { lat: String(loc.lat), lng: String(loc.lng) };
              }
            } catch (err) {
              console.warn('[geo.resolveMapUrl] geocode error:', err);
            }
            return null;
          };

          // ヘルパー: 逆ジオコーディング（Google Maps Geocoding API）
          const reverseGeocode = async (la: string, lo: string): Promise<string | null> => {
            try {
              const data = await makeRequest<GeocodingResult>('/maps/api/geocode/json', {
                latlng: `${la},${lo}`, language: 'ja',
              });
              if (data.results[0]) return data.results[0].formatted_address;
            } catch (err) {
              console.warn('[geo.resolveMapUrl] reverse geocode error:', err);
            }
            return null;
          };

          // ステップ1: @lat,lng パターンで座標抽出
          const atMatch = resolvedUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
          if (atMatch) { lat = atMatch[1]; lng = atMatch[2]; }

          // ?q=lat,lng パターン
          if (!lat) {
            const qMatch = resolvedUrl.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
            if (qMatch) { lat = qMatch[1]; lng = qMatch[2]; }
          }

          // ステップ2: テキスト情報を抽出するヘルパー関数
          // 『890-0056 鹿児島県鹿児島市下荒田３丁目３８−１８ 直球和食莫逆(ばくげき) スパイダースビル 1F』などを解析
          const parseQueryText = (raw: string): { address: string | null; placeName: string | null } => {
            // +をスペースに変換、先頭の『・』を除去
            let s = raw.replace(/\+/g, ' ').trim();
            // 〒・『など郵便番号プレフィックスを除去（文字コードに関わらず全て対応）
            s = s.replace(/^[\u3012\u300e\u300f\uff3c]?\d{3}-\d{4}[\s\u3000]+/, '').trim();
            s = s.replace(/^\u3012\d{3}-\d{4}[\s\u3000]+/, '').trim(); // 〒890-0056 形式
            s = s.replace(/^\u300e\d{3}-\d{4}[\s\u3000]+/, '').trim(); // 『890-0056 形式

            // 施設名と住所を分離: 全角スペース「　」で分割（修正: 全角スペース対応）
            const parts = s.split(/[\s\u3000]+/).filter(Boolean);
            
            // 都道府県を含むパートを検出
            let addressPart: string | null = null;
            let facilityPart: string | null = null;
            
            for (let i = 0; i < parts.length; i++) {
              if (/(?:都|道|府|県)/.test(parts[i])) {
                // 都道府県以降を住所として結合
                addressPart = parts.slice(i).join('');
                // 都道府県より前を施設名として結合
                facilityPart = parts.slice(0, i).join('');
                break;
              }
            }
            
            if (addressPart) {
              return {
                address: addressPart,
                placeName: facilityPart || null,
              };
            }

            // 都道府県パターンなし: 全体を施設名として扱う
            return { address: null, placeName: s || null };
          };

          // ステップ3: /place/名前/ パターンを解析
          const placeMatch = resolvedUrl.match(/\/place\/([^\/@?#]+)/);
          if (placeMatch) {
            const placeVal = decodeURIComponent(placeMatch[1]).replace(/\+/g, ' ').trim();
            const parsed = parseQueryText(placeVal);
            if (parsed.address) address = parsed.address;
            if (parsed.placeName) placeName = parsed.placeName;
          }

          // ステップ4: ?q= パラメータを解析（maps.google.com?q=... 形式）
          if (!address && !placeName) {
            try {
              const parsedUrl = new URL(resolvedUrl);
              const qVal = parsedUrl.searchParams.get('q');
              if (qVal && !/^-?\d+\.\d+,-?\d+\.\d+$/.test(qVal)) {
                const parsed = parseQueryText(qVal);
                if (parsed.address) address = parsed.address;
                if (parsed.placeName) placeName = parsed.placeName;
              }
            } catch (err) {
              console.warn("[routers] error:", err);
            }
          }

          // ステップ5: query= パラメータを解析（/maps/search/?api=1&query=... 形式）
          if (!address && !placeName) {
            try {
              const parsedUrl = new URL(resolvedUrl);
              const queryVal = parsedUrl.searchParams.get('query');
              if (queryVal && !/^-?\d+\.\d+,-?\d+\.\d+$/.test(queryVal)) {
                const parsed = parseQueryText(queryVal);
                if (parsed.address) address = parsed.address;
                if (parsed.placeName) placeName = parsed.placeName;
              }
            } catch (err) {
              console.warn("[routers] error:", err);
            }
          }

          console.log('[geo.resolveMapUrl] parsed:', { lat, lng, address, placeName });

          // ステップ6: 座標がない場合、Google Maps APIで検索
          if (!lat) {
            // 施設名＋住所で Places Text Search（最も精度が高い）
            if (placeName && address) {
              const r = await tryPlaceSearch(`${placeName} ${address}`);
              if (r) { lat = r.lat; lng = r.lng; }
            }
            // 施設名のみで Places Text Search
            if (!lat && placeName) {
              const r = await tryPlaceSearch(placeName);
              if (r) { lat = r.lat; lng = r.lng; }
            }
            // 住所で Geocoding API
            if (!lat && address) {
              const r = await tryGeocode(address);
              if (r) { lat = r.lat; lng = r.lng; }
            }
          }

          // ステップ7: 座標が取れたが住所がない場合、逆ジオコーディングで住所を取得
          if (lat && lng && !address) {
            address = await reverseGeocode(lat, lng);
          }

          return { resolvedUrl, lat, lng, address, placeName };
        } catch (e) {
          console.error('[geo.resolveMapUrl] error:', e);
          return { resolvedUrl: null, lat: null, lng: null, address: null, placeName: null };
        }
      }),
  }),

  // 場所候補検索API（Nominatim実データ使用・AIハルシネーション廃止）
  places: router({
    /**
     * タイトル入力からNominatimで実在する場所候補を検索する
     * 旅行先が指定されている場合はその地域を優先して検索
     * AIによる座標・住所の生成は一切行わず、APIから取得した実データのみを使用
     */
    search: publicProcedure
      .input(z.object({ query: z.string(), destination: z.string().optional() }))
      .mutation(async ({ input }) => {
        try {
          const { query, destination } = input;
          if (!query.trim()) return { places: [] };

          // カテゴリ推定（Google Maps types からマッピング）
          const guessCategory = (types: string[]): string => {
            if (types.some(t => ['restaurant','cafe','bar','food','bakery','meal_takeaway','meal_delivery','izakaya_restaurant','sushi_restaurant'].includes(t))) return '食事';
            if (types.some(t => ['lodging','hotel','motel'].includes(t))) return '宿泊';
            if (types.some(t => ['tourist_attraction','museum','zoo','aquarium','art_gallery','amusement_park','shrine','temple','church','place_of_worship'].includes(t))) return '観光';
            if (types.some(t => ['transit_station','train_station','subway_station','bus_station','airport'].includes(t))) return '移動';
            if (types.some(t => ['store','shopping_mall','supermarket','convenience_store','department_store','clothing_store'].includes(t))) return '買物';
            return 'その他';
          };

          // 検索クエリを構築（旅行先を付加することで地域優先）
          const searchQ = destination ? `${query} ${destination}` : query;

          // Google Maps Places Text Search で最大5件取得
          const data = await makeRequest<PlacesSearchResult>('/maps/api/place/textsearch/json', {
            query: searchQ,
            language: 'ja',
          });

          const places = (data.results || []).slice(0, 5).map(item => ({
            name: item.name,
            address: item.formatted_address,
            category: guessCategory(item.types),
            mapsUrl: `https://www.google.com/maps/place/?q=place_id:${item.place_id}`,
            lat: String(item.geometry.location.lat),
            lng: String(item.geometry.location.lng),
          }));

          return { places };
        } catch (e) {
          console.error('[places.search] error:', e);
          return { places: [] };
        }
      }),
  }),

  // 住所→座標変換API（サーバーサイドNominatim呼び出し）
  geocode: router({
    /** 住所文字列から座標を取得する（全角→半角変換・フォールバック対応） */
    byAddress: publicProcedure
      .input(z.object({ address: z.string() }))
      .mutation(async ({ input }) => {
        const raw = input.address.trim();
        if (!raw) return { lat: null, lng: null, displayName: null };

        // 全角数字・全角ハイフンを半角に変換
        const normalize = (s: string) =>
          s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
           .replace(/[－−‐]/g, '-')
           .replace(/[　]/g, ' ')
           .trim();

        // 番地を除去して町丁目までにする（フォールバック用）
        const stripBanchi = (s: string): string => {
          const n = normalize(s);
          const m = n.match(/^(.+?(?:町|丁目|丁))/);
          if (m) return m[1];
          return n.replace(/\s*\d+-\d+.*$/, '').trim();
        };

        const tryGeocode = async (q: string): Promise<{ lat: string; lng: string; displayName: string } | null> => {
          try {
            const data = await makeRequest<GeocodingResult>('/maps/api/geocode/json', {
              address: q, language: 'ja', region: 'jp',
            });
            if (data.results[0]) {
              const loc = data.results[0].geometry.location;
              return {
                lat: loc.lat.toFixed(6),
                lng: loc.lng.toFixed(6),
                displayName: data.results[0].formatted_address,
              };
            }
          } catch (err) {
            console.warn('[geocode.byAddress] error:', err);
          }
          return null;
        };

        // 試行順: 正規化済み → 番地なし → 元の文字列
        const normalized = normalize(raw);
        const banchiless = stripBanchi(raw);

        const candidates = [normalized];
        if (banchiless !== normalized) candidates.push(banchiless);
        if (raw !== normalized) candidates.push(raw);

        for (const q of candidates) {
          const result = await tryGeocode(q);
          if (result) return result;
        }

        return { lat: null, lng: null, displayName: null };
      }),
  }),

  // AIメモ解析API
  ai: router({
    /** テキストメモをAIが解析して予定リストに変換する */
    parseMemo: publicProcedure
      .input(z.object({
        memo: z.string(),
        dayDate: z.string(),
        destination: z.string(),
        tripDays: z.array(z.object({ dayIndex: z.number(), date: z.string() })).optional(),
      }))
      .mutation(async ({ input }) => {
        const daysInfo = input.tripDays && input.tripDays.length > 0
          ? `\n\n全日程情報（各予定にはdayIndexを必ず指定すること）:\n${input.tripDays.map(d => `  dayIndex ${d.dayIndex}: ${d.date}`).join('\n')}`
          : '';
        const systemPrompt = `あなたは旅行計画アシスタントです。ユーザーが入力した旅程メモを解析して、予定リストに変換してください。
出力はJSON配列で、各要素は以下のフィールドを持ちます：
- dayIndex: 日程番号（下記の全日程情報を参照。不明な場合は-1）
- time: 時刻（HH:MM形式、不明な場合は""）
- category: カテゴリ（"移動"、"食事"、"観光"、"宿泊"、"買物"、"その他" のいずれか）
- title: 予定のタイトル。「レストラン名」「観光スポット名」「飛行機の便名」など場所名・施設名を必ず入れる。例：「黒豚料理あぢもりで山山」「指宿温泉」「鹿児島アリーナ観光」
- location: 住所または具体的な場所名（都道府県から始まる住所、または施設名）
- memo: 補足メモ（フライト番号、予約番号、注意事項など）
- url: Google MapsのURL（判明している場合のみ、それ以外は""）
旅行先: ${input.destination}
対象日付: ${input.dayDate}${daysInfo}
【最重要ルール】
1. titleには必ず場所名・施設名を入れる。「食事」「観光」などの汎用的な言葉だけは不可。
2. 日付が明示されている予定は必ずdayIndexを正しく設定する（全日程情報を参照）。
3. 時刻が書かれていたら必ずtimeフィールドに入れる。
4. 移動（飛行機・電車・バス・車）、食事、観光、宿泊、買い物を適切にカテゴリ分けする。
5. メモには予約番号、フライト番号、注意事項などを入れる。
6. 必ずeventsオブジェクトを含むJSONを返す。`;
        try {
          const response = await invokeLLM({
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: input.memo },
            ],
            response_format: {
              type: 'json_schema',
              json_schema: {
                name: 'events',
                strict: true,
                schema: {
                  type: 'object',
                  properties: {
                    events: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          dayIndex: { type: 'number' },
                          time: { type: 'string' },
                          category: { type: 'string' },
                          title: { type: 'string' },
                          location: { type: 'string' },
                          memo: { type: 'string' },
                          url: { type: 'string' },
                        },
                        required: ['dayIndex', 'time', 'category', 'title', 'location', 'memo', 'url'],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ['events'],
                  additionalProperties: false,
                },
              },
            },
          });
          const rawContent = response.choices?.[0]?.message?.content;
          const content = typeof rawContent === 'string' ? rawContent : '{"events":[]}';
          const parsed = JSON.parse(content);
          return { ok: true as const, events: parsed.events || [] };
        } catch (e) {
          console.error('[ai.parseMemo] error:', e);
          return { ok: false as const, error: 'メモの解析に失敗しました', events: [] };
        }
      }),
  }),

  // 天気予報API（Open-Meteo使用）
  weather: router({
    /** 日付と地名から天気予報を取得する */
    getForecast: publicProcedure
      .input(z.object({
        date: z.string(),
        lat: z.number().optional(),
        lng: z.number().optional(),
        location: z.string().optional(),
      }))
      .query(async ({ input }) => {
        try {
          let lat = input.lat;
          let lng = input.lng;
          if ((!lat || !lng) && input.location) {
            try {
              // 複数目的地（「京都、大阪」「京都 大阪」など）の場合は最初の地名のみ使用
              const firstLocation = input.location
                .split(/[,、,\s\u3000]+/)
                .map(s => s.trim())
                .filter(s => s.length > 0)[0] || input.location;

              // バグ2修正: インメモリキャッシュでNominatim重複リクエストを防ぐ
              const cached = geoCache.get(firstLocation);
              if (cached) {
                lat = cached.lat;
                lng = cached.lng;
              } else {
                try {
                  const geoData = await makeRequest<GeocodingResult>('/maps/api/geocode/json', {
                    address: firstLocation, language: 'ja',
                  });
                  if (geoData.results[0]) {
                    lat = geoData.results[0].geometry.location.lat;
                    lng = geoData.results[0].geometry.location.lng;
                    geoCache.set(firstLocation, { lat, lng });
                  }
                } catch (geoErr2) {
                  console.warn('[weather.getForecast] geocode error:', geoErr2);
                }
              }
            } catch (geoErr) {
              console.warn('[weather.getForecast] geocoding failed:', geoErr);
            }
          }
          if (!lat || !lng) {
            return { ok: false as const, error: '座標を取得できませんでした' };
          }
          const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=Asia%2FTokyo&start_date=${input.date}&end_date=${input.date}`;
          // Node.js fetchがブロックされる場合はcurlフォールバックを使用
          let data: any;
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);
            data = await res.json();
          } catch {
            // curlフォールバック
            const { execSync } = await import('child_process');
            const raw = execSync(`curl -s --max-time 10 "${url}"`, { encoding: 'utf8' });
            data = JSON.parse(raw);
          }
          // バグ1修正: !x === undefined は常にfalse。正しくは x === undefined
          if (data?.daily?.weathercode?.[0] === undefined) {
            return { ok: false as const, error: '天気データを取得できませんでした' };
          }
          const wc = data.daily.weathercode[0];
          const tmax = data.daily.temperature_2m_max?.[0];
          const tmin = data.daily.temperature_2m_min?.[0];
          const precip = data.daily.precipitation_sum?.[0];
          const getWeatherIcon = (code: number): string => {
            if (code === 0) return '☀️';
            if (code <= 3) return '⛅';
            if (code <= 9) return '🌫️';
            if (code <= 19) return '⛅';
            if (code <= 29) return '🌧️';
            if (code <= 39) return '🌫️';
            if (code <= 49) return '🌨️';
            if (code <= 59) return '🌧️';
            if (code <= 69) return '🌧️';
            if (code <= 79) return '🌨️';
            if (code <= 84) return '🌦️';
            if (code <= 99) return '⚡';
            return '☁️';
          };
          const getWeatherLabel = (code: number): string => {
            if (code === 0) return '快晴';
            if (code <= 3) return '曇りがち';
            if (code <= 9) return '霧';
            if (code <= 19) return '曇';
            if (code <= 29) return '雨';
            if (code <= 39) return '霧';
            if (code <= 49) return '雪';
            if (code <= 59) return '小雨';
            if (code <= 69) return '雨';
            if (code <= 79) return '雪';
            if (code <= 84) return 'にわ雨';
            if (code <= 99) return '雷雨';
            return '曇';
          };
          return {
            ok: true as const,
            icon: getWeatherIcon(wc),
            label: getWeatherLabel(wc),
            tempMax: tmax !== undefined ? Math.round(tmax) : null,
            tempMin: tmin !== undefined ? Math.round(tmin) : null,
            precipitation: precip !== undefined ? Math.round(precip * 10) / 10 : null,
          };
        } catch (e) {
          console.error('[weather.getForecast] error:', e);
          return { ok: false as const, error: '天気情報の取得に失敗しました' };
        }
      }),
  }),

  // 移動時間計算
  travel: router({
    calcTime: publicProcedure
      .input(z.object({ origin: z.string(), destination: z.string(), mode: z.enum(['driving', 'walking', 'bicycling', 'transit']) }))
      .mutation(async ({ input }) => {
        try {
          // transitモードはDistance Matrix APIでZERO_RESULTSになるため、drivingにフォールバック
          const effectiveMode = input.mode === 'transit' ? 'driving' : input.mode;
          // Distance Matrix APIを使用（Directions APIより安定）
          const data = await makeRequest<any>('/maps/api/distancematrix/json', {
            origins: input.origin,
            destinations: input.destination,
            mode: effectiveMode,
            language: 'ja',
          });
          if (data.status === 'OK' && data.rows?.[0]?.elements?.[0]?.status === 'OK') {
            const el = data.rows[0].elements[0];
            return { ok: true as const, distance: el.distance.text, duration: el.duration.text, error: null };
          }
          // Distance Matrix失敗時はDirections APIにフォールバック
          const dirData = await makeRequest<any>('/maps/api/directions/json', {
            origin: input.origin,
            destination: input.destination,
            mode: effectiveMode,
            language: 'ja',
          });
          if (dirData.routes && dirData.routes.length > 0) {
            const leg = dirData.routes[0].legs[0];
            return { ok: true as const, distance: leg.distance.text, duration: leg.duration.text, error: null };
          }
          return { ok: false as const, distance: '', duration: '', error: 'ルートが見つかりませんでした' };
        } catch (e: any) {
          console.error('[travel.calcTime]', e);
          return { ok: false as const, distance: '', duration: '', error: e.message || '計算に失敗しました' };
        }
      }),
  }),

  // 写真アップロードAPI（S3永続保存）
  photo: router({
    /** base64画像をS3にアップロードしてURLを返す */
    upload: publicProcedure
      .input(z.object({
        base64: z.string(),          // data:image/jpeg;base64,... 形式
        clientId: z.string(),
        filename: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // data URLからフォーマットとバイナリを抽出
        const match = input.base64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
        if (!match) throw new Error('無効な画像データです');
        const contentType = match[1];
        const ext = contentType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
        const binaryStr = atob(match[2]);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        const suffix = Math.random().toString(36).slice(2, 10);
        const filename = input.filename || `photo-${suffix}.${ext}`;
        const key = `tabi-photos/${input.clientId}/${Date.now()}-${suffix}.${ext}`;
        const { url } = await storagePut(key, bytes, contentType);
        return { url, key };
      }),
  }),

  // ユーザー個人データ永続化API
  userData: router({
    /** ユーザーの旅行データを保存する */
    save: publicProcedure
      .input(z.object({ clientId: z.string(), tripData: z.string() }))
      .mutation(async ({ input }) => {
        await saveUserTripData(input.clientId, input.tripData);
        return { success: true };
      }),

    /** ユーザーの旅行データを取得する */
    load: publicProcedure
      .input(z.object({ clientId: z.string() }))
      .query(async ({ input }) => {
        const data = await getUserTripData(input.clientId);
        return { tripData: data };
      }),
  }),

  // みんなのおすすめスポット
  recommendedSpots: router({
    /** おすすめスポットを登録する */
    create: publicProcedure
      .input(z.object({
        placeName: z.string().min(1),
        category: z.string().default("その他"),
        address: z.string().default(""),
        lat: z.string().default(""),
        lng: z.string().default(""),
        comment: z.string().default(""),
        rating: z.number().int().min(1).max(5).default(3),
        sourceUrl: z.string().default(""),
        photoUrl: z.string().default(""),
        prefecture: z.string().default(""),
        userId: z.string(),
        userName: z.string(),
      }))
      .mutation(async ({ input }) => {
        const id = `spot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await createRecommendedSpot({
          id,
          userId: input.userId,
          userName: input.userName,
          placeName: input.placeName,
          category: input.category,
          address: input.address,
          lat: input.lat,
          lng: input.lng,
          comment: input.comment,
          rating: input.rating,
          sourceUrl: input.sourceUrl,
          photoUrl: input.photoUrl,
          prefecture: input.prefecture,
        });
        return { success: true, id };
      }),

    /** おすすめスポットを検索する */
    search: publicProcedure
      .input(z.object({
        prefecture: z.string().optional(),
        category: z.string().optional(),
        keyword: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const spots = await searchRecommendedSpots({
          prefecture: input.prefecture || undefined,
          category: input.category || undefined,
          keyword: input.keyword || undefined,
        });
        return { spots };
      }),

    /** SNS URLからOGPメタ情報を取得してAIで解析する */
    parseUrl: publicProcedure
      .input(z.object({ url: z.string() }))
      .mutation(async ({ input }) => {
        try {
          // OGPメタ情報を取得
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 15000);
          let html = "";
          try {
            const res = await fetch(input.url, {
              headers: { "User-Agent": "Mozilla/5.0 (compatible; TabiShiori/1.0)" },
              signal: controller.signal,
            });
            clearTimeout(timeout);
            html = await res.text();
          } catch {
            clearTimeout(timeout);
            return { success: false, error: "URLの取得に失敗しました" };
          }

          // OGPタグを抽出
          const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] || "";
          const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] || "";
          const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] || "";
          const pageTitle = html.match(/<title>([^<]+)<\/title>/i)?.[1] || "";

          const textContent = `ページタイトル: ${pageTitle}\nOGPタイトル: ${ogTitle}\n説明: ${ogDesc}`;

          // AIで店名・住所・カテゴリを抽出
          const llmRes = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `あなたは日本の旅行スポット情報を抽出するアシスタントです。以下のJSON形式で返してください：
{"placeName": "店名・スポット名", "address": "住所（都道府県から番地まで）", "prefecture": "都道府県名のみ", "category": "食事|観光|宿泊|買物|その他", "comment": "おすすめコメント（簡潔に）"}
住所が不明な場合はaddressとprefectureは空文字列で返してください。座標は絶対に生成しないでください。`,
              },
              { role: "user", content: textContent },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "spot_info",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    placeName: { type: "string" },
                    address: { type: "string" },
                    prefecture: { type: "string" },
                    category: { type: "string" },
                    comment: { type: "string" },
                  },
                  required: ["placeName", "address", "prefecture", "category", "comment"],
                  additionalProperties: false,
                },
              },
            },
          });

          const parsed = JSON.parse(llmRes.choices[0].message.content as string);

          // 住所があればGoogle Maps Geocoding APIで座標取得
          let lat = "";
          let lng = "";
          if (parsed.address) {
            try {
              const geoData = await makeRequest<GeocodingResult>('/maps/api/geocode/json', {
                address: parsed.address, language: 'ja', region: 'jp',
              });
              if (geoData.results[0]) {
                lat = String(geoData.results[0].geometry.location.lat);
                lng = String(geoData.results[0].geometry.location.lng);
              }
            } catch { /* 座標取得失敗は無視 */ }
          }

          return {
            success: true,
            placeName: parsed.placeName || "",
            address: parsed.address || "",
            prefecture: parsed.prefecture || "",
            category: parsed.category || "その他",
            comment: parsed.comment || "",
            photoUrl: ogImage || "",
            lat,
            lng,
          };
        } catch (err) {
          console.error("[recommendedSpots.parseUrl] error:", err);
          return { success: false, error: "解析に失敗しました" };
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
