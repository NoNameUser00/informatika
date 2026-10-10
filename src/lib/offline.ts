// Офлайн-режим (школьные сборки): роль вшивается на сборке.
// - online (по умолчанию): сайт как есть;
// - student: ключи вырезаны из данных, сдачи только в файл ответов;
// - teacher: полные банки с ключами + страница проверки файлов.
// Клиентская ветка — через PUBLIC_-переменную (Vite подставляет на сборке).
export type OfflineRole = 'online' | 'student' | 'teacher';

export const OFFLINE_ROLE: OfflineRole =
  (import.meta.env.PUBLIC_OFFLINE_ROLE as string | undefined) === 'student'
    ? 'student'
    : (import.meta.env.PUBLIC_OFFLINE_ROLE as string | undefined) === 'teacher'
      ? 'teacher'
      : 'online';

export const OFFLINE_STUDENT = OFFLINE_ROLE === 'student';
export const OFFLINE_TEACHER = OFFLINE_ROLE === 'teacher';

/** Формат файла ответов ученика (v1). Ключей внутри нет — только ответы. */
export const ANSWER_FORMAT = 'informatika-answer-v1';

export interface AnswerFile {
  format: string;
  test_code: string;
  variant: string;
  bank_hash: string;
  surname: string;
  firstname: string;
  class_name: string;
  answers: Record<string, string>;
  created_at: string;
}

/** Безопасное имя файла: только буквы/цифры/дефис, остальное — подчёркивание. */
export function safeName(s: string): string {
  const t = s.trim().replace(/\s+/g, '_');
  return t.replace(/[^A-Za-zА-Яа-яЁё0-9_-]/g, '_').slice(0, 40) || 'noname';
}

export function answerFileName(a: AnswerFile): string {
  return `${safeName(a.class_name)}_${safeName(a.surname)}_${safeName(a.firstname)}_${safeName(a.test_code)}_v${safeName(a.variant)}.json`;
}

/** Скачать объект как JSON-файл (ученик уносит файл учителю).
 * В приложении (Neutralino) — через системный диалог сохранения,
 * в браузере — обычное скачивание. */
export function downloadJson(obj: unknown, filename: string): void {
  void saveNative(obj, filename).then((saved) => {
    if (!saved) saveAnchor(obj, filename);
  });
}

async function saveNative(obj: unknown, filename: string): Promise<boolean> {
  try {
    const NL = (window as unknown as { Neutralino?: any }).Neutralino;
    if (!NL?.os?.showSaveDialog || !NL?.filesystem?.writeBinaryFile) return false;
    const path = await NL.os.showSaveDialog({ defaultPath: filename });
    if (!path) return false;
    const text = JSON.stringify(obj);
    await NL.filesystem.writeBinaryFile(path, new TextEncoder().encode(text));
    return true;
  } catch {
    return false;
  }
}

function saveAnchor(obj: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(obj)], { type: 'application/json;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
