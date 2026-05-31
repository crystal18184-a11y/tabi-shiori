// 旅のしおり PDFエクスポートユーティリティ
// jsPDFを使ってフロントエンドで直接PDFを生成する（日本語対応・写真埋め込み対応）
import jsPDF from "jspdf";
import type { Trip, TabiDay, TabiEvent } from "@/lib/store";
import { CATS } from "@/lib/store";

const COLORS = {
  primary: [15, 23, 42] as [number, number, number],       // #0f172a
  accent: [37, 99, 235] as [number, number, number],       // #2563eb
  muted: [30, 41, 59] as [number, number, number],         // #1e293b
  light: [226, 232, 240] as [number, number, number],      // #e2e8f0
  border: [148, 163, 184] as [number, number, number],     // #94a3b8
  hotel: [109, 40, 217] as [number, number, number],       // #6d28d9
  white: [255, 255, 255] as [number, number, number],
  subtext: [51, 65, 85] as [number, number, number],       // #334155
};

const FONT_NAME = "NotoSansJP";

/**
 * 写真（base64 data URL または URL）を取得してbase64 data URLに変換する。
 * すでにdata URLの場合はそのまま返す。
 */
async function fetchImageAsBase64(src: string): Promise<string | null> {
  if (!src) return null;
  try {
    if (src.startsWith("data:")) return src;
    const res = await fetch(src);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * 日本語フォント（NotoSansJP Regular + Bold）を動的ロードして jsPDF に登録する。
 * ローカルパス（public/fonts/）を優先して読み込む。
 */
async function addJapaneseFont(doc: jsPDF): Promise<string> {
  if (doc.getFontList()[FONT_NAME]) return FONT_NAME;

  async function loadFontBase64(urls: string[]): Promise<string> {
    for (const url of urls) {
      try {
        const response = await fetch(url);
        if (!response.ok) continue;
        const buffer = await response.arrayBuffer();
        return btoa(
          new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
        );
      } catch { /* 次のURLを試す */ }
    }
    throw new Error("フォントの読み込みに失敗しました");
  }

  // ローカルフォント優先（public/fonts/ に配置）
  try {
    const regularBase64 = await loadFontBase64([
      "/fonts/NotoSansJP-Regular.ttf",
    ]);
    doc.addFileToVFS("NotoSansJP-Regular.ttf", regularBase64);
    doc.addFont("NotoSansJP-Regular.ttf", FONT_NAME, "normal");

    const boldBase64 = await loadFontBase64([
      "/fonts/NotoSansJP-Bold.ttf",
    ]);
    doc.addFileToVFS("NotoSansJP-Bold.ttf", boldBase64);
    doc.addFont("NotoSansJP-Bold.ttf", FONT_NAME, "bold");

    return FONT_NAME;
  } catch (e) {
    console.warn("日本語フォントの読み込みに失敗しました。フォントファイルをpublic/fonts/に配置してください。", e);
    return "helvetica";
  }
}

function wrapText(doc: jsPDF, content: string, maxWidth: number): string[] {
  return doc.splitTextToSize(content, maxWidth);
}

/**
 * 画像のアスペクト比を考慮した実際の描画高さを返す
 * 横幅PHOTO_W mmに対応する高さを計算し、PHOTO_MAX_H を上限にクリップ
 */
async function loadPhotoWithSize(
  src: string,
  photoW: number,
  photoMaxH: number
): Promise<{ b64: string; drawH: number } | null> {
  const b64 = await fetchImageAsBase64(src);
  if (!b64) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const aspectRatio = img.naturalHeight / img.naturalWidth;
      const naturalH = photoW * aspectRatio;
      const drawH = Math.min(naturalH, photoMaxH);
      resolve({ b64, drawH });
    };
    img.onerror = () => resolve({ b64, drawH: photoMaxH });
    img.src = b64;
  });
}

export async function exportTripPdf(trip: Trip): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210;
  const MARGIN = 14;
  const CONTENT_W = W - MARGIN * 2;
  let y = MARGIN;

  const JP_FONT = await addJapaneseFont(doc);

  // ===== ヘルパー関数 =====
  function checkPageBreak(needed: number) {
    if (y + needed > 272) {
      doc.addPage();
      y = MARGIN;
    }
  }

  function drawRect(x: number, yy: number, w: number, h: number, color: [number, number, number], filled = true) {
    doc.setFillColor(...color);
    doc.setDrawColor(...color);
    if (filled) doc.rect(x, yy, w, h, "F");
    else doc.rect(x, yy, w, h, "S");
  }

  // 常にBoldで描画（全テキストBold化）
  function text(
    str: string,
    x: number,
    yy: number,
    size: number,
    color: [number, number, number],
    align: "left" | "center" | "right" = "left",
    bold = true
  ) {
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.setFont(JP_FONT, bold ? "bold" : "normal");
    doc.text(str, x, yy, { align });
  }

  // ===== 表紙 =====
  drawRect(0, 0, W, 50, COLORS.primary);
  text("旅のしおり", W / 2, 22, 22, COLORS.white, "center", true);
  text(trip.name || "旅行プラン", W / 2, 34, 14, [148, 163, 184], "center", true);
  if (trip.destination) {
    text(`[目的地] ${trip.destination}`, W / 2, 43, 10, [148, 163, 184], "center", true);
  }
  y = 58;

  // 旅行概要
  const startDate = trip.days.find(d => d.date)?.date;
  const endDate = [...trip.days].reverse().find(d => d.date)?.date;
  if (startDate || endDate) {
    const dateStr = startDate && endDate && startDate !== endDate
      ? `${startDate} 〜 ${endDate}`
      : startDate || endDate || "";
    text(dateStr, MARGIN, y, 10, COLORS.primary, "left", true);
    y += 6;
  }
  text(`全${trip.days.length}日間`, MARGIN, y, 10, COLORS.primary, "left", true);
  y += 10;

  doc.setDrawColor(...COLORS.border);
  doc.line(MARGIN, y, W - MARGIN, y);
  y += 8;

  // ===== 各Day =====
  const dayColors = [
    [59, 130, 246] as [number, number, number],
    [16, 185, 129] as [number, number, number],
    [245, 158, 11] as [number, number, number],
    [239, 68, 68] as [number, number, number],
    [139, 92, 246] as [number, number, number],
    [236, 72, 153] as [number, number, number],
  ];

  for (let di = 0; di < trip.days.length; di++) {
    const d = trip.days[di];
    const color = dayColors[di % dayColors.length];

    checkPageBreak(20);

    // Day ヘッダー
    drawRect(MARGIN, y, CONTENT_W, 10, color);
    const dayLabel = `Day ${di + 1}${d.name ? ` ・ ${d.name}` : ""}${d.date ? `  (${d.date})` : ""}`;
    text(dayLabel, MARGIN + 3, y + 7, 10, COLORS.white, "left", true);
    y += 13;

    // 宿泊先
    if (d.hotel) {
      checkPageBreak(10);
      drawRect(MARGIN, y, CONTENT_W, 8, COLORS.light);
      text(
        `[宿] ${d.hotel}${d.hotelReservationNo ? `  予約番号: ${d.hotelReservationNo}` : ""}`,
        MARGIN + 3, y + 5.5, 8, COLORS.hotel, "left", true
      );
      y += 10;
    }

    // 予定一覧
    if (d.events.length === 0) {
      checkPageBreak(8);
      text("（予定なし）", MARGIN + 3, y + 5, 8, COLORS.subtext, "left", true);
      y += 8;
    } else {
      for (const evt of d.events) {
        const catInfo = CATS[evt.category] || CATS["その他"];
        const titleLine = `${evt.time ? evt.time + "  " : ""}${catInfo.i} ${evt.title}`;
        const lines = wrapText(doc, titleLine, CONTENT_W - 6);

        // タイムラインの写真（photoフィールド + attachments）をbase64に変換
        // タイムラインのmaxHeight:160px ≈ 42mm に合わせた上限
        const PHOTO_MAX_H = 42;
        const PHOTO_W = CONTENT_W - 8;
        const PHOTO_MARGIN = 3;

        let photoResult: { b64: string; drawH: number } | null = null;
        if (evt.photo) {
          console.log("[PDF写真] 取得開始:", evt.photo);
          photoResult = await loadPhotoWithSize(evt.photo, PHOTO_W, PHOTO_MAX_H);
          if (photoResult) {
            console.log("[PDF写真] 取得成功 drawH:", photoResult.drawH, "b64長さ:", photoResult.b64.length);
          } else {
            console.warn("[PDF写真] 取得失敗:", evt.photo);
          }
        } else {
          console.log("[PDF写真] evt.photoなし。イベント:", evt.title);
        }

        const attachmentResults: { b64: string; drawH: number }[] = [];
        if (evt.attachments && evt.attachments.length > 0) {
          for (const src of evt.attachments) {
            const r = await loadPhotoWithSize(src, PHOTO_W, PHOTO_MAX_H);
            if (r) attachmentResults.push(r);
          }
        }

        const allPhotos = [
          ...(photoResult ? [photoResult] : []),
          ...attachmentResults,
        ];
        const photosH = allPhotos.length > 0
          ? allPhotos.reduce((sum, p) => sum + p.drawH + PHOTO_MARGIN, 0) + 2
          : 0;

        const blockH = Math.max(
          12,
          lines.length * 5.5
          + (evt.location ? 5.5 : 0)
          + (evt.memo ? 5.5 : 0)
          + (evt.reservationNo ? 5.5 : 0)
          + 5
          + photosH
        );

        checkPageBreak(blockH);

        // 左側のカラーバー
        drawRect(MARGIN, y, 2, blockH - 2, color);

        // タイトル（Bold）
        doc.setFontSize(9.5);
        doc.setTextColor(...COLORS.primary);
        doc.setFont(JP_FONT, "bold");
        doc.text(lines, MARGIN + 4, y + 6);
        let innerY = y + 6 + (lines.length - 1) * 5.5;

        // 場所（Bold）
        if (evt.location) {
          innerY += 4.5;
          doc.setFontSize(8);
          doc.setTextColor(...COLORS.subtext);
          doc.setFont(JP_FONT, "bold");
          const locLines = wrapText(doc, `[場所] ${evt.location}`, CONTENT_W - 8);
          doc.text(locLines, MARGIN + 4, innerY);
          innerY += (locLines.length - 1) * 4.5;
        }
        // 予約番号（Bold）
        if (evt.reservationNo) {
          innerY += 4.5;
          doc.setFontSize(8);
          doc.setTextColor(55, 48, 163);
          doc.setFont(JP_FONT, "bold");
          doc.text(`[予約] ${evt.reservationNo}`, MARGIN + 4, innerY);
        }
        // メモ（Bold）
        if (evt.memo) {
          innerY += 4.5;
          const memoLines = wrapText(doc, `[メモ] ${evt.memo}`, CONTENT_W - 8);
          doc.setFontSize(8);
          doc.setTextColor(...COLORS.subtext);
          doc.setFont(JP_FONT, "bold");
          doc.text(memoLines, MARGIN + 4, innerY);
          innerY += (memoLines.length - 1) * 4.5;
        }

        // 写真（アスペクト比保持・maxHeight:42mm上限）
        if (allPhotos.length > 0) {
          innerY += 4;
          for (const photo of allPhotos) {
            checkPageBreak(photo.drawH + PHOTO_MARGIN);
            try {
              const fmt = photo.b64.includes("data:image/png") ? "PNG" : "JPEG";
              doc.addImage(photo.b64, fmt, MARGIN + 4, innerY, PHOTO_W, photo.drawH);
            } catch {
              try {
                doc.addImage(photo.b64, "PNG", MARGIN + 4, innerY, PHOTO_W, photo.drawH);
              } catch {
                // 画像追加失敗はスキップ
              }
            }
            innerY += photo.drawH + PHOTO_MARGIN;
          }
        }

        y += blockH;

        doc.setDrawColor(...COLORS.border);
        doc.line(MARGIN + 2, y, W - MARGIN, y);
        y += 2;
      }
    }

    y += 4;
  }

  // ===== スポットプール =====
  const allSpots = trip.days.flatMap(d => d.pool || []);
  if (allSpots.length > 0) {
    doc.addPage();
    y = MARGIN;

    drawRect(0, 0, W, 16, COLORS.primary);
    text("▶ スポットプール（行きたい場所）", MARGIN, 11, 11, COLORS.white, "left", true);
    y = 24;

    for (const spot of allSpots) {
      checkPageBreak(14);
      drawRect(MARGIN, y, CONTENT_W, 12, COLORS.light);
      text(`★ ${spot.name}`, MARGIN + 3, y + 5, 9, COLORS.primary, "left", true);
      if (spot.location) {
        doc.setFontSize(7.5);
        doc.setTextColor(...COLORS.subtext);
        doc.setFont(JP_FONT, "bold");
        doc.text(`[場所] ${spot.location}`, MARGIN + 3, y + 10);
      }
      y += 14;
    }
    y += 4;
  }

  // ===== 割り勘 =====
  if ((trip.expenses || []).length > 0) {
    checkPageBreak(20);
    if (y > 200) { doc.addPage(); y = MARGIN; }

    drawRect(MARGIN, y, CONTENT_W, 10, COLORS.primary);
    text("■ 割り勘", MARGIN + 3, y + 7, 10, COLORS.white, "left", true);
    y += 13;

    const total = (trip.expenses || []).reduce((s, e) => s + e.amount, 0);
    text(`合計: ¥${total.toLocaleString()}`, MARGIN, y, 10, COLORS.primary, "left", true);
    y += 7;

    for (const exp of (trip.expenses || [])) {
      checkPageBreak(8);
      const payer = (trip.members || []).find(m => m.id === exp.payerId)?.name || "不明";
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.subtext);
      doc.setFont(JP_FONT, "bold");
      doc.text(`• ${exp.title}  ¥${exp.amount.toLocaleString()}  (支払: ${payer})`, MARGIN + 2, y);
      y += 6;
    }
  }

  // ===== フッター（全ページ） =====
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.subtext);
    doc.setFont(JP_FONT, "bold");
    doc.text(`旅のしおり - ${trip.name || "旅行プラン"}  |  ${i} / ${totalPages}`, W / 2, 293, { align: "center" });
  }

  // ===== ダウンロード =====
  const filename = `旅のしおり_${trip.name || "旅行プラン"}_${new Date().toLocaleDateString("ja-JP").replace(/\//g, "-")}.pdf`;
  doc.save(filename);
}
