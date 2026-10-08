// Edge Function: приём попытки проверочной/контрольной, СЕРВЕРНАЯ проверка, запись в results.
// Ключи ученику НЕ возвращаются и во фронтенд НЕ вшиты (страницы грузят *-public.json).
// Банк и чекеры — synced-копии single source (npm run edge:sync, паритет — edge-sync.test.mjs).
// Тренажёр считает баллы в клиенте (допустимо: ответы тренажёра не секретны).
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { z } from 'https://esm.sh/zod@3.23.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.2';
import { taskCorrect } from './vendor/src/lib/analytics/aggregate.mjs';
import { percentToMark } from './vendor/src/lib/scoring/check.mjs';

const BANK_DIR = new URL('./vendor/bank/', import.meta.url);
let bankCache: Record<string, { tasks: BankTask[]; max_score: number }> | null = null;

interface BankTask {
  id: string;
  type: string;
  lesson: string;
  points: number;
  prompt: string;
  key?: string;
  expected?: number;
  base?: number;
  correct?: string;
  answerMap?: Record<string, string>;
}

const payloadSchema = z.object({
  surname: z.string().trim().min(1).max(80),
  firstname: z.string().trim().min(1).max(80),
  class_name: z.string().trim().min(1).max(20),
  test_type: z.enum(['proverka', 'control']),
  test_code: z.string().min(1).max(80),
  variant: z.string().min(1).max(40),
  answers: z.record(z.string().min(1).max(80), z.string().max(2000)),
  student_id: z.string().uuid().optional(),
  consent: z.literal(true),
});

async function loadBank(testCode: string) {
  if (!bankCache) {
    bankCache = {};
    for await (const e of Deno.readDir(BANK_DIR)) {
      if (!e.isFile || !e.name.endsWith('.json')) continue;
      const j = JSON.parse(await Deno.readTextFile(new URL('./' + e.name, BANK_DIR)));
      bankCache[j.test_code] = { tasks: j.tasks, max_score: j.max_score };
    }
  }
  return bankCache[testCode];
}

serve(async (req) => {
  if (req.method === 'GET') {
    // Банк для учителя (аналитика): только teacher/admin, ключи — только им.
    const url = new URL(req.url);
    const testCode = url.searchParams.get('test_code') ?? '';
    const bank = await loadBank(testCode);
    if (!bank) return Response.json({ error: 'unknown test_code' }, { status: 400 });
    const sUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const sAnon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!sUrl || !sAnon || !authHeader) return Response.json({ error: 'login required' }, { status: 401 });
    const sb = createClient(sUrl, sAnon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return Response.json({ error: 'login required' }, { status: 401 });
    const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).maybeSingle();
    const r = (profile as { role?: string } | null)?.role;
    if (r !== 'teacher' && r !== 'admin') return Response.json({ error: 'teacher only' }, { status: 403 });
    return Response.json({ test_code: testCode, variant: 'v1', page_size: 5, ...bank });
  }
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'bad json' }, { status: 400 });
  }
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'bad payload', issues: parsed.error.issues.map((i) => i.path.join('.')) }, { status: 400 });
  }
  const p = parsed.data;

  const bank = await loadBank(p.test_code);
  if (!bank) return Response.json({ error: 'unknown test_code' }, { status: 400 });

  let total = 0;
  const keys: Record<string, string> = {};
  for (const t of bank.tasks) {
    const v = taskCorrect(t as never, p.answers[t.id]);
    if (v) total += t.points;
    keys[t.id] = String((t as BankTask).key ?? '');
  }
  total = Math.round(total * 100) / 100;
  const percent = Math.round((total / bank.max_score) * 1000) / 10;
  const mark = percentToMark(percent);

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!url || !anon) return Response.json({ error: 'server misconfigured' }, { status: 500 });
  const authHeader = req.headers.get('Authorization') ?? '';
  const sb = createClient(url, anon, { global: { headers: authHeader ? { Authorization: authHeader } : {} } });
  const { data: { user } } = await sb.auth.getUser();

  const { error: insError } = await sb.from('results').insert({
    surname: p.surname,
    firstname: p.firstname,
    class_name: p.class_name,
    test_type: p.test_type,
    test_code: p.test_code,
    variant: p.variant,
    answers: p.answers,
    keys,
    auto_score: total,
    max_score: bank.max_score,
    percent,
    proposed_mark: mark,
    student_id: p.student_id ?? null,
    user_id: user?.id ?? null,
    consent: true,
  });
  if (insError) {
    return Response.json({ error: 'not saved: ' + insError.message }, { status: 403 });
  }
  // Ученику — только итоги, без ключей и без разбивки по вопросам.
  return Response.json({ total, max: bank.max_score, percent, mark });
});
