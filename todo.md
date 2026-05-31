# 旅のしおり - TODO

## 初回実装
- [x] 基本的な旅のしおりアプリ（タイムライン・スポット・割り勘・カウントダウン）
- [x] Leaflet地図コンポーネント（全日程・当日表示切替）
- [x] 予定追加/編集モーダル
- [x] スポットプールモーダル
- [x] 割り勘計算機能
- [x] undo機能（Ctrl+Z）
- [x] URLエンコード共有機能

## 追加要件（2026-02-23）
- [x] 地図UIのシンプル化（CartoDB Voyagerタイル、コントロール最小化）
- [x] 右サイドバーのスポットクリックで地図フォーカス（flyTo + ポップアップ）
- [x] Google Maps URL座標解析強化（短縮URL対応、複数パターン対応）
- [x] 日付タブの選択状態の色修正（アクティブタブに色付き背景）
- [x] 機能タブを一段下に移動（独立した行として分離）
- [x] リアルタイム共有機能（DBポーリング方式、共有コード発行・参加）
- [x] web-db-userアップグレード（MySQL + tRPC + 認証）
- [x] shared_tripsテーブル作成・マイグレーション
- [x] 共有モーダルUI（コード発行・参加・停止）

## バグ修正・機能追加（2026-02-23 追加）
- [x] 共有モーダルに「コードを入力して参加」UIを常時表示（共有していない人でも参加可能に）
- [x] 共有URLをコピーできるボタンを追加（コードだけでなくURLも共有可能に）
- [x] 共有者以外も共有コードを新規作成できるようにする
- [x] 住所テキスト（〜町〜丁目）をNominatimで座標変換できるようにする
- [x] アプリを閉じてもデータが消えないようにDBへ永続化する

## 機能改善（2026-02-23 追加）
- [x] Google Maps短縮URLから住所を抽出して「場所」フィールドに自動反映
- [x] 「📍 座標取得」で座標を確定し地図にも即時反映- [x] データ永続化の確定化（起動時は常にDBから読み込む・ localStorageは補助のみ）
- [x] 地図タブの右サイドバーを開閉できるようにする

## UI改善・バグ修正（2026-02-23 追加）
- [x] 地図サイドバーの開閉ボタンを正しく動作させる（右端に固定表示）
- [x] 住所から都道府県・市区町村のみ抽出（〒番号・番地・号を除去）
- [x] ヘッダー部分を縮小してコンテンツ表示領域を拡大（共有ボタンをヘッダー行に統合）
- [x] データ永続化の根本修正（clientIdをuuidで固定化・DB保存の確実化）

## バグ修正（2026-02-23 追加）
- [x] geo.resolveMapUrl: ?qパラメータからの住所抽出に対応（/place/パターンのみだったのを修正）
- [x] cleanJapaneseAddress: +記号（スペース代替）を除去してから処理する

## 機能追加（2026-02-23）
- [x] URL解析で番地まで含む住所全文を取得し座標を特定する
- [x] タイトル入力でAIが場所候補を検索・選択でGoogle Maps URLを自動入力
- [x] 地図タブでスポット間をルート線でつなぐ（日程順）
- [x] タイムラインの予定をドラッグ&ドロップで並び替え

## バグ修正・機能追加（2026-02-23 第3弾）
- [x] 住所全文から座標特定が失敗する問題をサーバーサイドジオコーディングAPIで修正（全角変換・フォールバック対応）
- [x] AI場所候補検索をスポット機能でも使えるようにする（PoolModalにAI検索・ URL解析追加）
- [x] スポット機能内でスポット新規作成できる（機能タブに「＋ スポット追加」ボタンがすでに存在）
- [x] タイムラインに予定新規作成ボタンがすでに存在（機能タブに「＋ 追加」ボタンがすでに存在）

## バグ修正・機能改善（2026-02-23 第4弾）
- [x] /maps/search/?api=1&query=形式のGoogle Maps URLから座標を取得できるよう修正（query=パラメータ抽出+施設名フォールバック）
- [x] タイムラインドラッグ&ドロップ改善（DragOverlay・キーボードセンサー追加・フローティングカードUI）

## バグ修正・機能追加（2026-02-24 第2弾）
- [x] URL解析バグ修正（住所フィールドが空・施設名に謎の文字列が表示される問題）
- [x] アプリ起動時の旅行作成ウィザード（旅行名・場所・期間を最初に聞いて新規作成）

## バグ修正（2026-02-24 第3弾）
- [x] EvtModalのキャンセル・保存ボタンをヘッダー直下（上）に戻す
- [x] アイコンを ✈️ 🌸 に修正（ヘッダー・ブラウザタイトル）
- [x] URL解析・座標取得の動作確認と修正

## バグ修正（2026-02-24 第4弾）
- [x] URL解析の根本修正（謎の文字列除去・住所・座標を正確に取得）
- [x] アプリアイコンを✈️🌸の画像に変更する（manifest.json・favicon・apple-touch-icon設定）

## バグ修正・機能復元（2026-02-24 第5弾）
- [x] AIメモ読み取り機能（MemoImportModal）が消えている → 復元済み
- [x] AIメモ読み取りの精度向上（場所名をタイトルに入れる、データを適切なフィールドに振り分け）
- [x] メモ読み取りはどのDayを選択しても全Dayに反映する（Day1選択でもDay1,2両方に反映）
- [x] 泊まるホテルを設定する欄が消えている → 復元済み
- [x] 予定追加でタイトル入力時のAI場所候補検索が出てこない → 復元・改善済み
- [x] 「ばくげき」入力で「直球和食莫逆(ばくげき) + Google Maps URL」が出るようにする（AIプロンプト改善）
- [x] 添付画像をタイムラインに表示させる（ImageLightbox復元）
- [x] 座標特定がおかしくなる問題の修正（curlフォールバック・全角→半角変換強化）
- [x] Manus.1.6.Maxで依頼した内容で消えている機能を全て復元する（完了）

## バグ修正・改善（2026-02-24 第6弾）
- [x] 割り勘機能の支出追加ボタンが反応しない問題を修正する（支払者必須バリデーション追加）
- [x] アプリアイコンの色を鮮やかにする（鮮やかな青い飛行機＋ビビッドピンクの桜の花で再生成）

## 機能改善（2026-02-24 第7弾）
- [x] 割り勘フォームをスクロール対応にして「支出を追加」ボタンを常に見える位置に配置する
- [x] DayタブにWeatherBadge天気予報機能を追加する（curlフォールバックで修正）

## 機能修正・改善（2026-02-24 第8弾）
- [x] 移動時間計算機能が動かない問題を修正してテストする
- [x] 割り勘の支出一覧をスクロール可能にする（支出が増えても見やすく）
- [x] 天気予報に手動更新ボタンを追加する

## PDF改善（2026-02-24 第9弾）
- [x] PDFエクスポートを日本語フォント（NotoSansJP）対応に修正する（helvetica→NotoSansJP、フォント動的ロード）

## PDF改善（2026-02-24 第10弾）
- [x] PDFの見やすさ改善（カラー強化・絵文字対応・予約番号色変更・区切り線強調）

## PDF改善（2026-02-24 第11弾）
- [x] PDFに写真埋め込み対応（attachmentsのbase64画像をPDFに挿入）
- [x] NotoSansJP-Bold対応（タイトルをboldで描画）
- [x] 絵文字→テキスト記号化（[目的地][宿][場所][予約][メモ]▶★■）
- [x] checkPageBreak閾値を272に変更（フッター余白確保）

## PDF改善（2026-02-24 第12弾）
- [x] PDF全テキストをBold化（[場所][メモ]等のサブテキストも含む）
- [x] タイムラインのphotoフィールドをPDFに埋め込む（store.tsのTabiEvent.photoを使用）

## PDF・写真改善（2026-02-24 第13弾）
- [x] PDFの写真高さをPHOTO_H=70mmに変更（正方形に近いサイズ）
- [x] タイムラインの写真をS3に永続保存するサーバーサイドAPIを実装
- [x] タイムラインの写真アップロードUIをS3保存に切り替える（base64→S3 URL）

## PDF改善（2026-02-24 第14弾）
- [x] PDFの写真をアスペクト比保持・最大高さ42mmで描画（loadPhotoWithSize関数追加）
- [x] フォントをローカルパス優先（CDN削除）に変更
- [x] console.logデバッグ出力を追加（写真取得状況の確認用）

## 天気予報修正（2026-02-24 第15弾）
- [x] 天気予報APIのジオコーディングを複数目的地対応に修正（「京都、大阪」→最初の地名「京都」を使用）
- [x] console.logでinput.locationを出力して確認

## 天気予報バグ修正（2026-02-24 第16弾）
- [x] 天気予報が取得できなくなった原因を特定して修正する（staleTimeをキャッシュ短縮・retry:2・fetchタイムアウト延長）

## 天気予報表示改善（2026-02-24 第17弾）
- [x] Dayタブの天気予報に最高気温と最低気温を両方表示する（現在は最高気温のみ）

## ユーザー修正案の適用（2026-02-25）
- [x] バグ1修正: weathercode undefined判定の誤り修正（!x === undefined → x === undefined）
- [x] バグ2修正: Nominatimレートリミット対策（インメモリキャッシュ追加）
- [x] バグ3修正: 日付タイムゾーンずれ修正（parseDateLocal関数追加）
- [x] コンポーネント分離: CountdownView.tsx を独立ファイルに
- [x] コンポーネント分離: MapSidebar.tsx を独立ファイルに（hasCoord関数使用）
- [x] コンポーネント分離: WarikanView.tsx を独立ファイルに
- [x] useUndoHistoryフック: undoロジックをTabiContextから分離
- [x] hasCoord関数: store.tsに追加（空文字列の誤判定修正）
- [x] store.ts: lat/lngをoptional（undefined）に変更、エラーハンドリング改善
- [x] TabiContext.tsx: useUndoHistoryフック使用に変更
- [x] TabiApp.tsx: 新コンポーネントをimportして使用
- [x] WeatherBadge.tsx: parseDateLocal・staleTime調整
- [x] server/routers.ts: バグ1・2修正適用
- [x] server/tabi.test.ts: 天気予報バグ修正テスト追加

### v2修正案の適用（2026-02-25）
- [x] WeatherBadge.tsx: インラインスタイル→Tailwind CSS化・アクセシビリティ対応
- [x] CountdownView.tsx: Tailwind CSS化・日程未設定時の空状態表示追加
- [x] MapSidebar.tsx: Tailwind CSS化
- [x] WarikanView.tsx: Tailwind CSS化
- [x] TabiApp.tsx: useMemo/useCallback最適化・TAB_LABELS定数追加
- [x] useEvtForm.ts: EvtModalのフォームロジックを独立フックに分離
- [x] EvtModal.tsx: useEvtFormフック使用に変更
- [x] store.ts: LocalStorage容量対策（4.5MB超でbase64除去）
- [x] server/db.ts: DBサイズバリデーション（60KB超を拒否）
- [x] server/routers.ts: 空catchのconsole.warn追加
- [x] server/tabi.test.ts: v2テストスイートに更新（44件・全パス）

## バグ調査・修正（2026-02-25）
- [x] バグ①: スポットタブに登録したものが地図タブに表示されない → LeafletMapにpoolスポットの★マーカー追加
- [x] バグ②: スポットから予定に登録したものが地図タブに反映されない → PoolModalにlat/lng保存を修正

## URL解析バグ修正（2026-02-25）
- [x] バグ修正: parseQueryText関数が全角スペース「　」を認識していない問題を修正
  - 施設名と住所の分離が正しく動作するようになりました
  - 例: "トカラ馬牧場　鹿児島県鹿児島市喜入生見町3149-6" → 施設名「トカラ馬牧場」、住所「鹿児島県鹿児島市喜入生見町3149-6」
- [x] URL解析テスト8件追加（座標抽出・住所抽出・全角スペース対応など）

## MapSidebar改善（2026-02-25）
- [x] MapSidebarのスポット一覧をDay単位で分けて表示した（現在は一括表示）
  - 予定（events）のようにDay毎に「Day 1」「Day 2」等でグループ分けする
  - スポット（pool）も同じDay単位で表示する

## 新機能追加（2026-02-25）
- [x] スポット一覧クリック時の地図フォーカス機能
  - MapSidebarのスポット（pool）をクリックすると地図が自動スクロール・ズームする
  - onFocusEventを pool_${id} 形式で拡張してLeafletMapで対応
- [x] スポット座標の一括取得機能
  - PoolModalに「座標を取得」ボタンを追加
  - 座標がないスポットに対して住所から座標を一括取得できる
- [x] 電車移動時間計算機能
  - Google Maps Directions APIで電車ルートの移動時間を取得
  - 予定間の移動時間を自動計算・表示
  - 交通手段選択（電車・車・徒歩）に対応

## 移動時間計算バグ修正（2026-02-25）
- [x] バグ修正: 移動時間計算で「ルートが見つかりませんでした」と表示される
  - 原因: Google MapsプロキシアピリのtransitモードがZERO_RESULTSを返す
  - 修正: Distance Matrix APIに切り替え、transitはdrivingにフォールバック
  - TravelTimeWidgetのモードをdriving/walkingの2种に絞り込み（transit/bicyclingは削除）

## tabi-shiori-updated.zip統合（2026-03-03）
- [x] server/routers.ts: 場所候補検索をAI→Nominatim実データに変更
- [x] client/src/contexts/TabiContext.tsx: updateExpense関数追加
- [x] client/src/components/WarikanView.tsx: 経費編集モーダル追加
- [x] client/src/components/TabiApp.tsx: updateExpense props追加
- [x] client/src/components/EvtModal.tsx: UI文言修正（AI→場所候補）
- [x] client/src/components/PoolModal.tsx: Nominatim座標直接使用
- [x] client/src/hooks/useEvtForm.ts: Nominatim座標直接使用
- [x] テスト実行・TypeScriptエラー確認（52件全パス・TSエラーなし）
- [ ] チェックポイント保存

## みんなのおすすめスポット機能（2026-03-04）
- [x] drizzle/schema.ts: recommended_spotsテーブル追加
- [x] pnpm db:push: マイグレーション実行
- [x] server/routers.ts: recommendedSpots.create追加
- [x] server/routers.ts: recommendedSpots.search追加
- [x] server/routers.ts: recommendedSpots.parseUrl追加
- [x] client/src/components/RecommendedSpotsView.tsx: 新規作成（検索・一覧・スポットプール追加）
- [x] client/src/components/RecommendedSpotModal.tsx: 新規作成（投稿モーダル・URL自動解析）
- [x] client/src/components/TabiApp.tsx: ⭐おすすめタブ追加・ルーティング統合
- [x] TypeScriptエラーなし・テスト52件全パス・Viteビルド成功
- [ ] チェックポイント保存

## SNS用旅程画像書き出し機能（2026-03-05）
- [x] client/src/components/TripImageExportModal.tsx: 新規作成
- [x] client/src/components/TabiApp.tsx: 📸ボタン追加・モーダル統合
- [x] TypeScriptエラー確認・テスト全パス
- [x] チェックポイント保存

## App.tsx・LinkPage・TabiApp統合（2026-03-05）
- [x] client/src/components/TripImageExportModal.tsx: 新規作成（SNS用画像書き出し）
- [x] client/src/pages/LinkPage.tsx: 新規作成（インスタリンク用LP）
- [x] client/src/App.tsx: /linkルートを追加
- [x] client/src/components/TabiApp.tsx: TripImageExportModal統合・📸ボタン追加
- [x] TypeScriptエラー確認・テスト全パス
- [x] チェックポイント保存

## 提供コード統合・修正（2026-03-05 第2弾）
- [x] TabiApp.tsx: useThemeをimport、おすすめ追加機能を統合
- [x] TripImageExportModal.tsx: エラーハンドリングを改善、canvas表示ロジックを改善
- [x] LinkPage.tsx: useEffect対応、SpotData型定義を追加
- [x] テスト 52件全パス・TypeScriptエラーなし・Viteビルド成功
- [ ] チェックポイント保存

## おすすめスポット追加UI改善（2026-03-05 第3弾）
- [x] TabiApp.tsx: タイムラインイベント上に『⭐ おすすめに追加』ボタンを追加
- [x] TabiApp.tsx: スポットプール上に『⭐ おすすめに追加』ボタンを追加
- [x] RecommendedModalcomponent: おすすめ追加モーダルを実装・改善
- [x] server/routers.ts: おすすめスポット作成APIのテストを追加
- [x] database: 追加されたおすすめスポットをDB確認テストで検証

## おすすめボタン情報入力バグ修正（2026-03-06）
- [x] ブラウザログ・サーバーログを調査して原因を特定
- [x] handleAddEventToRecommendedの実装を確認・修正
- [x] RecommendedSpotModalに初期値を正しく渡す
- [x] 修正後のテストを実行して動作確認
- [ ] チェックポイント保存


## 実装すべき機能（2026-03-06）

### ユーザープロフィール・マイページ
- [ ] ユーザープロフィールページの作成（/profile）
- [ ] ユーザー情報表示・編集機能
- [ ] 投稿したおすすめスポット履歴表示
- [ ] 旅行履歴一覧表示
- [ ] プロフィール画像アップロード機能

### おすすめスポット詳細ページ
- [ ] おすすめスポット詳細ページの作成（/recommended/:id）
- [ ] 投稿者情報表示
- [ ] 評価・コメント・写真表示
- [ ] スポットの「いいね」機能実装
- [ ] コメント機能実装
- [ ] 「このスポットをタイムラインに追加」ボタン

### 検索・フィルタ機能の強化
- [ ] おすすめスポット検索ページの改善
- [ ] 都道府県別フィルタ機能
- [ ] カテゴリ別フィルタ機能
- [ ] ユーザー名でのフィルタ
- [ ] 評価順ソート機能
- [ ] 新着順ソート機能
- [ ] 旅行検索機能（旅行名・期間・場所で検索）

### SNS連携・OGP対応
- [ ] LinkPageにOGPメタタグ追加（og:title, og:description, og:image）
- [ ] おすすめスポット詳細ページのOGP対応
- [ ] おすすめスポット共有ボタン（Instagram・Twitter）
- [ ] 旅行共有ボタン（Instagram・Twitter）

### 通知機能
- [ ] 共有相手のアクティビティ通知実装
- [ ] おすすめスポット「いいね」通知
- [ ] コメント通知
- [ ] 通知一覧ページ作成

### モバイルアプリ化
- [ ] PWA対応（manifest.json拡張）
- [ ] オフライン機能実装（Service Worker）
- [ ] Push通知実装
- [ ] インストール促進UI

### その他の改善
- [ ] 都道府県の自動抽出機能（住所から都道府県を自動抽出）
- [ ] おすすめスポット投稿時のハッシュタグ入力フィールド
- [ ] ユーザーフォロー機能
- [ ] おすすめスポットのランキング表示
- [ ] 地域別おすすめスポット集計

## 削除してもいい機能（オプション）

### 削除候補
- [ ] AIメモ読み取り機能（使用頻度が低い場合）
- [ ] 移動時間計算機能（基本的な距離表示のみで十分な場合）
- [ ] 複数交通手段対応（車・徒歩のみに絞る場合）
- [ ] カウントダウン機能（旅程表示で十分な場合）
- [ ] 割り勘機能（別アプリに任せる場合）


## タイムラインボタン修正（2026-03-06 第2弾）
- [x] TabiApp.tsx: ナビバーの「＋ 追加」ボタンを削除（timeline時のみ）
- [x] TimelineView: propsに`onAddEvent`を追加
- [x] TimelineView: `headerArea`を定義（宿バナー＋予定追加ボタン）
- [x] TimelineView: レンダリングを修正（予定なし時・予定あり時）
- [x] テスト実行・ビルド確認
- [x] チェック## タイムラインボタン修正（2026-03-13 完全版）
- [x] TabiApp.tsx: ナビバー修正（timeline時の「＋ 追加」削除、pool時の「＋ スポット追加」残す）
- [x] TabiApp.tsx: TimelineView呼び出しを修正（day・onUpdateHotel削除、onAddEvent追加）
- [x] TimelineView: props型定義を修正（day・onUpdateHotel削除、onAddEvent追加）
- [x] TimelineView: 宿泊先関連state・ hotelBannerを削除
- [x] TimelineView: レンダリングを修正（予定なし時・予定あり時に上部ボタンを追加）
- [x] TabiContext.tsxを修正（updateHotelを削除）
- [x] テスト実行・ビルド確認
- [ ] チェックポイント保存ateHotel実装を削除
- [ ] TabiContext.tsx: updateHotelをproviderのvalueから削除
- [ ] テスト実行・ビルド確認
- [ ] チェックポイント保存


## PoolView上部ボタン固定表示（2026-03-13）
- [x] PoolViewの現在の実装を確認
- [x] PoolViewのprops型定義を修正（onAddSpot追加）
- [x] PoolView内にheaderAreaを定義（スポット追加ボタン）
- [x] PoolViewのレンダリングを修正（スポットなし時・あり時）
- [x] TabiApp.tsxのPoolView呼び出しを修正（onAddSpot追加）
- [x] テスト実行・ビルド確認
- [ ] チェックポイント保存
