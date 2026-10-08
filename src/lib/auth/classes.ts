// Классы и вступление учеников: клиентские вызовы SECURITY DEFINER функций (0004).
// Валидация входа — Zod здесь (TS-слой) + CHECK/guard в SQL (второй рубеж).
// Нормализация ФИО — ТОЛЬКО на сервере (norm_fio), клиент её не делает.
import { z } from 'zod';
import { getClient, isAuthConfigured } from './client';

const codeSchema = z.string().trim().transform((s) => s.toUpperCase()).pipe(z.string().min(6).max(8));
const fioSchema = z.string().min(1).max(80);
const classNameSchema = z.string().trim().min(1).max(20);
const emailSchema = z.string().trim().toLowerCase().pipe(z.string().email());
const uuidSchema = z.string().uuid();

export interface ClassInfo {
  id: string;
  code: string;
  name: string;
}

export interface JoinResult {
  student_id: string;
  is_duplicate: boolean;
  display_name: string;
}

function needClient() {
  const c = getClient();
  if (!c) throw new Error('Бэкенд не настроен (см. docs/auth-setup.md).');
  return c;
}

/** Учитель создаёт класс: код генерирует сервер. */
export async function createClass(name: string): Promise<ClassInfo> {
  const c = needClient();
  const parsed = classNameSchema.safeParse(name);
  if (!parsed.success) throw new Error('Название класса: 1–20 символов.');
  const { data, error } = await c.rpc('create_class', { p_name: parsed.data });
  if (error) throw new Error(error.message);
  const row = (data as ClassInfo[])[0];
  if (!row) throw new Error('Сервер не вернул класс.');
  return row;
}

/** Вступление ученика: код + ФИО. student_id сохраняется локально для привязки работ. */
export async function joinClass(code: string, fio: string): Promise<JoinResult> {
  const c = needClient();
  const codeParsed = codeSchema.safeParse(code);
  const fioParsed = fioSchema.safeParse(fio.trim().replace(/\s+/g, ' '));
  if (!codeParsed.success) throw new Error('Код класса: 6–8 символов.');
  if (!fioParsed.success) throw new Error('ФИО: 1–80 символов.');
  const { data, error } = await c.rpc('join_class', { p_code: codeParsed.data, p_fio: fioParsed.data });
  if (error) throw new Error(error.message);
  const row = (data as JoinResult[])[0];
  if (!row?.student_id) throw new Error('Сервер не вернул student_id.');
  try {
    localStorage.setItem('student-id-v1', JSON.stringify({ student_id: row.student_id, code: codeParsed.data }));
  } catch { /* приватный режим */ }
  return row;
}

/** Админ назначает учителя по почте. */
export async function approveTeacherByEmail(email: string): Promise<string> {
  const c = needClient();
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) throw new Error('Некорректная почта.');
  const { data, error } = await c.rpc('approve_teacher_by_email', { p_email: parsed.data });
  if (error) throw new Error(error.message);
  return String(data);
}

/** Учитель разбирает дубль: оставить keep, удалить drop. */
export async function resolveDuplicate(keep: string, drop: string): Promise<void> {
  const c = needClient();
  const k = uuidSchema.safeParse(keep);
  const d = uuidSchema.safeParse(drop);
  if (!k.success || !d.success) throw new Error('Некорректный id.');
  const { error } = await c.rpc('resolve_duplicate', { p_keep: k.data, p_drop: d.data });
  if (error) throw new Error(error.message);
}

export function isBackend(): boolean {
  return isAuthConfigured();
}
