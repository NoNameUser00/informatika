// Zod-схемы банка заданий. Источник формата для:
// - валидации bank.yaml (scripts/validate-bank),
// - разделения student_view / teacher_view в API,
// - Edge-функции submit-attempt.
import { z } from 'zod';

const meta = z.object({
  id: z.string().min(1),
  class: z.number().int(),
  topic: z.string().min(1),
  subtopic: z.string().min(1),
  points: z.number().positive(),
  difficulty: z.enum(['basic', 'intermediate', 'advanced']),
  cognitive_level: z.enum(['remember', 'apply', 'analyze']),
  lesson: z.string().min(1),
  fgos_requirement: z.union([z.literal(1.1), z.literal(1.2)]),
  fgos_element: z.union([z.literal(1.1), z.literal(1.2), z.literal(1.3), z.literal(1.4)]),
  fgos: z.object({ subject: z.array(z.string()), meta: z.array(z.string()) }),
  prompt: z.string().min(1),
});

const numericTask = meta.extend({
  type: z.literal('numeric_base'),
  student_view: z.object({ base: z.number().int().positive(), placeholder: z.string().optional() }),
  auto_check: z.object({
    method: z.literal('numeric_base'),
    base: z.number().int().positive(),
    strip_affixes: z.boolean().optional(),
  }),
  teacher_only: z.object({
    accepted_values_decimal: z.array(z.number()).min(1),
    answer_text: z.string().min(1),
    explanation: z.string().min(1),
  }),
});

const singleTask = meta.extend({
  type: z.literal('single_choice'),
  student_view: z.object({
    options: z.array(z.object({ id: z.string().min(1), text: z.string() })).min(2),
  }),
  auto_check: z.object({ method: z.literal('exact_option') }),
  teacher_only: z.object({
    answer: z.string().min(1),
    explanation: z.string().min(1),
    common_errors: z.array(z.string()).optional(),
  }),
});

const matchingTask = meta.extend({
  type: z.literal('matching'),
  student_view: z.object({ left: z.array(z.string()).min(1), right: z.array(z.string()).min(1) }),
  auto_check: z.object({ method: z.literal('matching'), partial: z.string().optional() }),
  teacher_only: z.object({
    answer_map: z.record(z.string(), z.string()),
    explanation: z.string().min(1),
  }),
});

export const taskSchema = z.discriminatedUnion('type', [numericTask, singleTask, matchingTask]);
export const bankSchema = z.array(taskSchema);
export type BankTask = z.infer<typeof taskSchema>;

// Разделение представлений: ученику — без teacher_only (единая точка для API).
export function splitViews(task: BankTask) {
  const { teacher_only: _teacher, ...rest } = task;
  void _teacher;
  return { student: rest, teacher: task };
}
