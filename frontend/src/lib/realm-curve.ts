/**
 * Chiều cao cột (0–1) cho đường cong linh khí của một cảnh giới.
 *
 * `linhKhiRequired` tăng theo cấp số nhân giữa các tiểu cảnh giới, nên vẽ trên
 * thang tuyến tính sẽ dí bốn cột đầu xuống sát đáy và đường cong mất hết thông
 * tin. Vẽ trên thang log biến tỉ lệ tăng không đổi thành bước nhảy không đổi —
 * đó chính là thứ người cân bằng game muốn nhìn.
 */

/** Cột thấp nhất vẫn phải nhìn thấy được, không tụt về 0. */
export const CURVE_MIN_HEIGHT = 0.12;

export function curveHeights(values: number[]): number[] {
  if (values.length === 0) return [];

  // Ô admin đang gõ dở (input rỗng → NaN) hoặc số không dương thì không có
  // logarit. Cột đó vẽ bằng 0 thay vì đầu độc min/max của cả dãy.
  const usable = (v: number) => Number.isFinite(v) && v > 0;
  const logs = values.filter(usable).map((v) => Math.log(v));
  if (logs.length === 0) return values.map(() => 0);

  const min = Math.min(...logs);
  const max = Math.max(...logs);

  // Một cột, hoặc mọi cột bằng nhau: không có biên độ để chuẩn hóa — cho đầy.
  if (max === min) return values.map((v) => (usable(v) ? 1 : 0));

  return values.map((v) => {
    if (!usable(v)) return 0;
    const t = (Math.log(v) - min) / (max - min);
    return CURVE_MIN_HEIGHT + t * (1 - CURVE_MIN_HEIGHT);
  });
}
