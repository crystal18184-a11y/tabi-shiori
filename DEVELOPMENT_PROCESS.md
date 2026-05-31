# 旅のしおりアプリ — 開発プロセス・技術実装ガイド

## 開発の全体像

旅のしおりアプリは、**Manus プラットフォーム**上で構築された、React + Express + tRPC + MySQL を使用した**フルスタック旅行管理アプリ**です。以下は開発過程と技術的な実装方法の概要です。

---

## 第1段階：プロジェクト初期化（2026-02-23）

### 使用したツール
- **webdev_init_project** — Manus の web-db-user テンプレートで新規プロジェクト作成
- **webdev_add_feature** — データベース、サーバー、ユーザー認証機能を追加

### 実装内容
- **フロントエンド**: React 19 + Tailwind CSS 4 + shadcn/ui コンポーネント
- **バックエンド**: Express 4 + tRPC 11 + MySQL/TiDB
- **認証**: Manus OAuth（ビルトイン）
- **データベース**: Drizzle ORM でスキーマ定義

### 主要ファイル構成
```
client/src/
  ├── pages/        # ページコンポーネント
  ├── components/   # UI コンポーネント
  ├── contexts/     # React Context（TabiContext）
  ├── lib/          # ユーティリティ関数
  └── _core/hooks/  # カスタムフック

server/
  ├── routers.ts    # tRPC ルーター定義
  ├── db.ts         # データベースクエリ
  └── _core/        # OAuth、認証、LLM等の基盤機能

drizzle/
  └── schema.ts     # データベーススキーマ
```

---

## 第2段階：データモデル設計（2026-02-23）

### store.ts で型定義
```typescript
// 旅行の基本単位
interface TabiTrip {
  id: string;
  name: string;
  destination: string;
  startDate: number;  // Unix timestamp (ms)
  endDate: number;
  days: TabiDay[];
  members: string[];
  expenses: TabiExpense[];
  sharedWith: string[];
  hotel?: { name, url, reservationNo };
}

// 1日分の予定
interface TabiDay {
  id: string;
  date: number;
  name: string;
  events: TabiEvent[];
  hotelReservationNo?: string;
  attachments: string[];  // 画像URL
}

// 予定の詳細
interface TabiEvent {
  id: string;
  title: string;
  time: string;
  location: string;
  lat?: number;
  lng?: number;
  reservationNo?: string;
  attachments: string[];
}

// 割り勘
interface TabiExpense {
  id: string;
  title: string;
  amount: number;
  payer: string;
  members: string[];
}

// 思い出記録
interface Memory {
  id: string;
  dayId: string;
  text: string;
  images: string[];
  createdAt: number;
}
```

### データベーススキーマ（drizzle/schema.ts）
```typescript
export const trips = sqliteTable('trips', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  destination: text('destination'),
  startDate: integer('start_date'),
  endDate: integer('end_date'),
  userId: text('user_id').notNull(),
  createdAt: integer('created_at'),
});

// days, events, expenses, memories テーブルも同様に定義
```

---

## 第3段階：UI コンポーネント開発（2026-02-23）

### TabiApp.tsx（メインコンポーネント）
**責務**: 旅行の全体的なレイアウトと状態管理

```typescript
export default function TabiApp() {
  const { trips, currentTrip, addTrip, updateTrip } = useTabi();
  
  return (
    <div className="flex flex-col h-screen">
      {/* ヘッダー */}
      <header className="flex items-center justify-between p-4 bg-white border-b">
        <h1>旅のしおり</h1>
        <button onClick={() => setShowNewTripDialog(true)}>新しい旅行</button>
      </header>

      {/* タブナビゲーション */}
      <div className="flex gap-2 p-4 overflow-x-auto">
        {currentTrip?.days.map(day => (
          <DayTab key={day.id} day={day} />
        ))}
      </div>

      {/* メインコンテンツ */}
      <main className="flex-1 overflow-y-auto">
        {activeTab === 'timeline' && <TimelineView />}
        {activeTab === 'spot' && <SpotView />}
        {activeTab === 'warikan' && <WarikanView />}
        {activeTab === 'memories' && <MemoriesView />}
      </main>

      {/* モーダル */}
      <EvtModal isOpen={showEvtModal} onClose={() => setShowEvtModal(false)} />
      <MemoImportModal isOpen={showMemoImport} onImport={handleMemoImport} />
    </div>
  );
}
```

### TimelineView（タイムライン表示）
**責務**: 日付順に予定を表示、ホテル設定、天気予報表示

```typescript
function TimelineView() {
  const { currentDay, events } = useTabi();
  
  return (
    <div className="space-y-4 p-4">
      {/* 天気バッジ */}
      <WeatherBadge date={currentDay.date} location={currentTrip.destination} />
      
      {/* ホテル設定 */}
      <div className="border rounded-lg p-4">
        <button onClick={() => setShowHotelModal(true)}>
          🏨 この日の宿を設定
        </button>
      </div>

      {/* 予定一覧 */}
      {events.map(event => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );
}
```

### WarikanView（割り勘管理）
**責務**: メンバー管理、支出追加、精算結果表示

```typescript
function WarikanView() {
  const [members, setMembers] = useState<string[]>([]);
  const [expenses, setExpenses] = useState<TabiExpense[]>([]);
  
  const handleAddExpense = (title: string, amount: number, payer: string, memberIds: string[]) => {
    // バリデーション
    if (!payer) {
      toast("支払者を選択してください");
      return;
    }
    
    // 支出を追加
    const expense: TabiExpense = {
      id: generateId(),
      title,
      amount,
      payer,
      members: memberIds,
    };
    
    addExpense(expense);
    
    // 精算結果を計算
    const settlements = calcSettlements(expenses);
    setSettlements(settlements);
  };

  return (
    <div className="space-y-6 p-4">
      {/* 統計 */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="合計支出" value={`¥${totalAmount}`} />
        <StatCard label="メンバー" value={`${members.length}人`} />
        <StatCard label="支出件数" value={`${expenses.length}件`} />
      </div>

      {/* メンバー管理 */}
      <section>
        <h3>👥 メンバー</h3>
        <div className="space-y-2">
          {members.map(member => (
            <MemberBadge key={member} name={member} />
          ))}
          <input placeholder="名前を入力" onChange={e => setNewMember(e.target.value)} />
          <button onClick={handleAddMember}>追加</button>
        </div>
      </section>

      {/* 支出追加フォーム（スクロール対応） */}
      <section className="border rounded-lg p-4">
        <h3>💳 支出を追加</h3>
        <div className="max-h-64 overflow-y-auto space-y-4">
          <input placeholder="内容" value={expenseTitle} onChange={e => setExpenseTitle(e.target.value)} />
          <input type="number" placeholder="金額" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} />
          <select value={expensePayer} onChange={e => setExpensePayer(e.target.value)}>
            <option value="">支払者を選択</option>
            {members.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <div className="space-y-2">
            {members.map(m => (
              <label key={m}>
                <input type="checkbox" onChange={e => toggleMember(m, e.target.checked)} />
                {m}
              </label>
            ))}
          </div>
        </div>
        <button onClick={handleAddExpense} className="mt-4 w-full">支出を追加</button>
      </section>

      {/* 精算結果 */}
      <section>
        <h3>💰 精算結果</h3>
        {settlements.length === 0 ? (
          <p>精算不要 / メンバーと支出を追加してください</p>
        ) : (
          settlements.map(s => <p key={s.id}>{s.from}が{s.to}に¥{s.amount}払う</p>)
        )}
      </section>
    </div>
  );
}
```

---

## 第4段階：バックエンド API 開発（tRPC ルーター）

### server/routers.ts の主要プロシージャ

#### 1. 旅行管理
```typescript
const router = t.router({
  trip: t.router({
    create: protectedProcedure
      .input(z.object({ name: z.string(), destination: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const trip = await db.createTrip({
          name: input.name,
          destination: input.destination,
          userId: ctx.user.id,
        });
        return trip;
      }),
    
    list: protectedProcedure
      .query(async ({ ctx }) => {
        return await db.getTripsByUserId(ctx.user.id);
      }),
  }),
});
```

#### 2. 地図・ジオコーディング
```typescript
geo: t.router({
  resolveMapUrl: publicProcedure
    .input(z.object({ url: z.string() }))
    .query(async ({ input }) => {
      // Google Maps 短縮URL → リダイレクト先を取得
      const resolvedUrl = await fetchWithCurlFallback(input.url);
      
      // URL から住所を抽出
      const address = parseQueryText(resolvedUrl);
      
      // Nominatim で座標を取得（全角→半角変換対応）
      const coords = await tryNominatim(address);
      
      return { address, lat: coords.lat, lng: coords.lng };
    }),
  
  calcTravelTime: publicProcedure
    .input(z.object({ from: z.object({ lat, lng }), to: z.object({ lat, lng }) }))
    .query(async ({ input }) => {
      // Google Maps Distance Matrix API で移動時間を計算
      const result = await makeRequest('GET', '/distancematrix/json', {
        origins: `${input.from.lat},${input.from.lng}`,
        destinations: `${input.to.lat},${input.to.lng}`,
        mode: 'transit',
      });
      
      return { duration: result.rows[0].elements[0].duration.text };
    }),
}),
```

#### 3. AI メモ読み取り
```typescript
ai: t.router({
  parseMemo: protectedProcedure
    .input(z.object({ memo: z.string(), tripId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // LLM でメモをパース
      const response = await invokeLLM({
        messages: [
          {
            role: 'system',
            content: `以下のメモを解析して、各日付の予定を抽出してください。
            
            出力形式:
            {
              "days": [
                {
                  "date": "2026-02-24",
                  "events": [
                    { "time": "12:00", "title": "ランチ", "location": "渋谷" }
                  ]
                }
              ]
            }`,
          },
          { role: 'user', content: input.memo },
        ],
        response_format: { type: 'json_schema', ... },
      });
      
      // パース結果を各 Day に追加
      const parsed = JSON.parse(response.choices[0].message.content);
      for (const dayData of parsed.days) {
        await db.addEventsToDay(dayData.date, dayData.events);
      }
      
      return { success: true };
    }),
}),
```

#### 4. 天気予報（curlフォールバック対応）
```typescript
weather: t.router({
  getForecast: publicProcedure
    .input(z.object({ lat: z.number(), lng: z.number(), date: z.string() }))
    .query(async ({ input }) => {
      // Nominatim で座標から住所を取得
      const addressResult = await fetchWithCurlFallback(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${input.lat}&lon=${input.lng}`
      );
      const address = JSON.parse(addressResult).address.city || 'Unknown';
      
      // Open-Meteo で天気予報を取得（curlフォールバック）
      const forecastResult = await fetchWithCurlFallback(
        `https://api.open-meteo.com/v1/forecast?latitude=${input.lat}&longitude=${input.lng}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&date=${input.date}`
      );
      const forecast = JSON.parse(forecastResult);
      
      return {
        location: address,
        weatherCode: forecast.daily.weather_code[0],
        tempMax: forecast.daily.temperature_2m_max[0],
        tempMin: forecast.daily.temperature_2m_min[0],
        precipitation: forecast.daily.precipitation_sum[0],
      };
    }),
}),
```

#### 5. 場所候補検索（AI 強化版）
```typescript
places: t.router({
  search: publicProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ input }) => {
      // LLM で場所の候補を生成
      const response = await invokeLLM({
        messages: [
          {
            role: 'system',
            content: `ユーザーが入力した場所名から、実在する日本の施設を検索してください。
            
            入力が略称や通称の場合も対応してください。
            例: "ばくげき" → "直球和食莫逆(ばくげき)"
            
            出力形式:
            {
              "candidates": [
                {
                  "name": "直球和食莫逆(ばくげき)",
                  "address": "鹿児島県鹿児島市下荒田３丁目３８−１８",
                  "url": "https://maps.app.goo.gl/K52RyZTAyt6wGpVf8"
                }
              ]
            }`,
          },
          { role: 'user', content: input.query },
        ],
        response_format: { type: 'json_schema', ... },
      });
      
      return JSON.parse(response.choices[0].message.content);
    }),
}),
```

---

## 第5段階：高度な機能の実装

### WeatherBadge コンポーネント
```typescript
function WeatherBadge({ date, location }: Props) {
  const { data: forecast, isLoading } = trpc.weather.getForecast.useQuery({
    lat: currentTrip.lat,
    lng: currentTrip.lng,
    date: formatDate(date),
  });

  if (isLoading) return <div className="animate-pulse">天気読込中...</div>;
  
  const weatherEmoji = {
    0: '☀️',  // Clear
    1: '⛅',  // Partly cloudy
    3: '☁️',  // Overcast
    45: '🌫️', // Foggy
    61: '🌧️', // Rain
    80: '⛈️', // Thunderstorm
  }[forecast.weatherCode] || '❓';

  return (
    <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
      <span className="text-2xl">{weatherEmoji}</span>
      <div>
        <p className="font-semibold">{location}</p>
        <p className="text-sm text-gray-600">
          {forecast.tempMax}°C / {forecast.tempMin}°C
        </p>
      </div>
    </div>
  );
}
```

### MemoImportModal コンポーネント
```typescript
function MemoImportModal({ isOpen, onImport }: Props) {
  const [memo, setMemo] = useState('');
  const parseMemo = trpc.ai.parseMemo.useMutation();

  const handleImport = async () => {
    const result = await parseMemo.mutateAsync({
      memo,
      tripId: currentTrip.id,
    });
    
    // 全 Day に反映
    for (const day of currentTrip.days) {
      await updateDay(day.id, { events: [...day.events, ...result.events] });
    }
    
    onImport();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onImport}>
      <DialogContent>
        <h2>📋 メモ読み取り</h2>
        <textarea
          placeholder="旅行の予定をテキストで貼り付けてください..."
          value={memo}
          onChange={e => setMemo(e.target.value)}
          className="w-full h-40 p-2 border rounded"
        />
        <button onClick={handleImport} disabled={parseMemo.isPending}>
          {parseMemo.isPending ? '読み取り中...' : 'AIで読み取る'}
        </button>
      </DialogContent>
    </Dialog>
  );
}
```

---

## 第6段階：問題解決とバグ修正

### 問題1: Google Maps URL のリダイレクト取得がタイムアウト
**原因**: Node.js の fetch がブロックされている
**解決**: curlフォールバック方式を実装
```typescript
async function fetchWithCurlFallback(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return await response.text();
  } catch (error) {
    // curlフォールバック
    const { stdout } = execSync(`curl -s -L "${url}"`, { encoding: 'utf-8' });
    return stdout;
  }
}
```

### 問題2: 割り勘の支払者が未選択でも追加できる
**原因**: バリデーションロジックが不足
**解決**: 支払者必須チェックを追加
```typescript
const handleAddExpense = (title, amount, payer, memberIds) => {
  if (!title || isNaN(amount) || amount <= 0) {
    toast("内容と金額を入力してください");
    return;
  }
  if (!payer) {
    toast("支払者を選択してください");  // ← 追加
    return;
  }
  if (!memberIds.length) {
    toast("誰の分か選んでください");
    return;
  }
  // 追加処理...
};
```

### 問題3: 支出追加フォームがスマートフォンで画面外に出る
**原因**: フォームが縦に長い
**解決**: スクロール対応レイアウトに変更
```typescript
<section className="border rounded-lg p-4">
  <h3>💳 支出を追加</h3>
  <div className="max-h-64 overflow-y-auto space-y-4">
    {/* フォーム要素 */}
  </div>
  <button className="mt-4 w-full">支出を追加</button>
</section>
```

### 問題4: 天気予報が表示されない
**原因**: Open-Meteo API へのfetchがブロック
**解決**: curlフォールバックで対応（問題1と同じ）

---

## 技術スタックの詳細

### フロントエンド
| 技術 | 用途 |
|------|------|
| React 19 | UI フレームワーク |
| Tailwind CSS 4 | スタイリング |
| shadcn/ui | UI コンポーネント |
| tRPC | 型安全な API クライアント |
| React Query | サーバー状態管理 |
| Wouter | ルーティング |

### バックエンド
| 技術 | 用途 |
|------|------|
| Express 4 | Web フレームワーク |
| tRPC 11 | RPC フレームワーク |
| Drizzle ORM | データベース操作 |
| MySQL/TiDB | データベース |
| LLM API | AI メモ読み取り、場所候補検索 |
| Google Maps API | 地図、ジオコーディング、距離計算 |
| Open-Meteo API | 天気予報 |
| Nominatim API | 逆ジオコーディング |

### デプロイ・ホスティング
| サービス | 用途 |
|---------|------|
| Manus | ホスティング、OAuth、LLM API |
| S3 | 画像・ファイルストレージ |

---

## 主要な設計パターン

### 1. React Context による状態管理
```typescript
// TabiContext.tsx
interface TabiContextType {
  trips: TabiTrip[];
  currentTrip: TabiTrip | null;
  currentDay: TabiDay | null;
  addTrip: (trip: TabiTrip) => void;
  updateTrip: (tripId: string, updates: Partial<TabiTrip>) => void;
  addEvent: (dayId: string, event: TabiEvent) => void;
  addExpense: (expense: TabiExpense) => void;
  // ... その他の操作
}

export const useTabi = () => useContext(TabiContext);
```

### 2. tRPC の型安全性
```typescript
// サーバー側で定義したルーターの型が、
// クライアント側で自動的に推論される
const { data, isLoading } = trpc.trip.list.useQuery();
//    ↑ Trip[] 型が自動推論

const createTrip = trpc.trip.create.useMutation();
await createTrip.mutateAsync({ name: '...' });
//                             ↑ 入力型がチェックされる
```

### 3. 楽観的更新（Optimistic Update）
```typescript
const addEventMutation = trpc.event.add.useMutation({
  onMutate: async (newEvent) => {
    // UI を即座に更新
    await queryClient.cancelQueries({ queryKey: ['event.list'] });
    const previousEvents = queryClient.getQueryData(['event.list']);
    queryClient.setQueryData(['event.list'], (old) => [...old, newEvent]);
    return { previousEvents };
  },
  onError: (err, newEvent, context) => {
    // エラー時はロールバック
    queryClient.setQueryData(['event.list'], context.previousEvents);
  },
});
```

---

## 今後の拡張可能性

### 短期（1-2週間）
- [ ] 音声入力でメモ読み取り
- [ ] SNS シェア機能
- [ ] PDF エクスポートの改善
- [ ] オフラインモード（Service Worker）

### 中期（1-2ヶ月）
- [ ] AI による旅行提案
- [ ] 決済機能（Stripe 統合）
- [ ] リアルタイム共有（WebSocket）
- [ ] 多言語対応

### 長期（3-6ヶ月）
- [ ] モバイルアプリ化（React Native）
- [ ] AR 機能（観光地の情報表示）
- [ ] 機械学習による推奨スポット

---

## まとめ

旅のしおりアプリは、**Manus プラットフォームの豊富な API**（OAuth、LLM、ストレージ、地図）を活用して、**フルスタック開発の最良実践**を示すアプリケーションです。

- **型安全性**: TypeScript + tRPC で端から端まで型チェック
- **ユーザー体験**: React の楽観的更新で高速な UI
- **スケーラビリティ**: tRPC ルーターの分割、Drizzle ORM の活用
- **保守性**: コンポーネント分割、カスタムフック、Context API

これらの技術と設計パターンは、他の web アプリケーション開発にも応用できます。
