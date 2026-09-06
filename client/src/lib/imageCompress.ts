// 旅のしおり - 画像圧縮ユーティリティ
// DB保存前に画像をリサイズ・再エンコードしてサイズを抑える。
// これをしないと写真のbase64がそのままMEDIUMTEXT枠(8MB上限)を圧迫し、
// 保存や共有同期が黙って失敗する原因になる。

const MAX_DIMENSION = 1280; // 長辺の最大px
const JPEG_QUALITY = 0.72;

/**
 * data URL形式の画像を読み込み、長辺をMAX_DIMENSIONに収まるようリサイズし、
 * JPEGとして再エンコードしたdata URLを返す。
 * 失敗した場合は元のdata URLをそのまま返す（安全側に倒す）。
 */
export function compressImageDataUrl(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const { width, height } = img;
        const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
        const w = Math.max(1, Math.round(width * scale));
        const h = Math.max(1, Math.round(height * scale));

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(dataUrl); return; }
        ctx.drawImage(img, 0, 0, w, h);

        const compressed = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
        // 圧縮結果が元より大きい場合（既に小さい画像など）は元データを使う
        resolve(compressed.length < dataUrl.length ? compressed : dataUrl);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/** Fileを読み込んで圧縮済みdata URLを返す */
export function readAndCompressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const raw = ev.target?.result as string;
      try {
        resolve(await compressImageDataUrl(raw));
      } catch {
        resolve(raw);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
