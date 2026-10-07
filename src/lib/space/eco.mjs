// Политика авто-эко для фона: чистая функция, тестируется.
// factor — доля от ползунка пользователя (1 = без срезания).
export const ECO_MIN = 0.15;
export const ECO_LOW_FPS = 28;
export const ECO_HIGH_FPS = 55;

export function ecoStep(fps, factor) {
  if (fps < ECO_LOW_FPS && factor > ECO_MIN) return Math.max(ECO_MIN, factor * 0.7);
  if (fps > ECO_HIGH_FPS && factor < 1) return Math.min(1, factor / 0.7);
  return factor;
}
