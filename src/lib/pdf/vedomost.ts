// Настоящие PDF-ведомости (jsPDF + autotable), вместо печати из браузера.
// Кириллица — встроенным DejaVuSans (OFL) из public/fonts.
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const FONT_URL = `${import.meta.env.BASE_URL}fonts/DejaVuSans.ttf`;
let fontReady = false;

async function ensureFont(doc: jsPDF): Promise<void> {
  if (fontReady) {
    doc.setFont('DejaVuSans');
    return;
  }
  const res = await fetch(FONT_URL);
  if (!res.ok) throw new Error('нет шрифта для PDF');
  const buf = new Uint8Array(await res.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 8192) {
    bin += String.fromCharCode(...buf.subarray(i, i + 8192));
  }
  doc.addFileToVFS('DejaVuSans.ttf', btoa(bin));
  doc.addFont('DejaVuSans.ttf', 'DejaVuSans', 'normal');
  doc.setFont('DejaVuSans');
  fontReady = true;
}

function header(doc: jsPDF, title: string, sub: string): void {
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFontSize(10);
  doc.text(sub, 14, 23);
}

const tableStyle = {
  styles: { font: 'DejaVuSans', fontSize: 9 },
  headStyles: { fillColor: [30, 58, 138] as [number, number, number] },
};

export interface ClassRow {
  fio: string;
  score: number;
  max: number;
  percent: number;
  mark: number;
}

export async function classPdf(title: string, className: string, rows: ClassRow[], filename: string): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  await ensureFont(doc);
  header(doc, title, `Класс: ${className}`);
  autoTable(doc, {
    ...tableStyle,
    startY: 28,
    head: [['№', 'ФИО ученика', 'Баллы', 'Отметка']],
    body: rows.map((r, i) => [String(i + 1), r.fio, `${r.score} из ${r.max} (${r.percent}%)`, String(r.mark)]),
  });
  doc.save(filename);
}

export interface StudentQ {
  prompt: string;
  answer: string;
  key: string;
  ok: boolean | null;
}

export interface StudentSheet {
  title: string;
  fio: string;
  className: string;
  variant: string;
  questions: StudentQ[];
  correct: number;
  questionsTotal: number;
  total: number;
  max: number;
  percent: number;
  mark: number;
}

export async function studentsPdf(sheets: StudentSheet[], filename: string): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  await ensureFont(doc);
  sheets.forEach((s, si) => {
    if (si > 0) doc.addPage();
    header(doc, `${s.title} — лист ученика`, `${s.fio} · класс ${s.className} · вариант ${s.variant}`);
    autoTable(doc, {
      ...tableStyle,
      startY: 28,
      head: [['№', 'Вопрос', 'Ответ ученика', 'Верно']],
      body: s.questions.map((q, i) => [
        String(i + 1),
        q.prompt,
        q.answer || '—',
        q.ok === null ? 'на проверке' : q.ok ? '+' : '−',
      ]),
      columnStyles: { 1: { cellWidth: 90 }, 2: { cellWidth: 55 } },
    });
    const y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    doc.setFontSize(11);
    doc.text(
      `Верных: ${s.correct} из ${s.questionsTotal} · Баллы: ${s.total} из ${s.max} (${s.percent}%) · Отметка: ${s.mark}`,
      14,
      y,
    );
  });
  doc.save(filename);
}

export interface TaskStat {
  prompt: string;
  correct: number;
  n: number;
  pct: number;
}

export interface LessonStat {
  lesson: string;
  correct: number;
  n: number;
  pct: number;
  level: string;
}

export async function analyticsPdf(
  title: string,
  subtitle: string,
  perTask: TaskStat[],
  perLesson: LessonStat[],
  filename: string,
): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  await ensureFont(doc);
  header(doc, `${title} — аналитика для учителя`, subtitle);
  let y = 28;
  if (perTask.length > 0) {
    autoTable(doc, {
      ...tableStyle,
      startY: y,
      head: [['№', 'Вопрос', 'Верно', '%']],
      body: perTask.map((q, i) => [String(i + 1), q.prompt, `${q.correct}/${q.n}`, `${q.pct}%`]),
      columnStyles: { 1: { cellWidth: 110 } },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }
  if (perLesson.length > 0) {
    doc.setFontSize(12);
    doc.text(perTask.length > 0 ? 'По темам' : 'Распределение', 14, y);
    autoTable(doc, {
      ...tableStyle,
      startY: y + 4,
      head: [['Тема', 'Верно', '%', 'Уровень']],
      body: perLesson.map((L) => [L.lesson, `${L.correct}/${L.n}`, `${L.pct}%`, L.level]),
    });
  }
  doc.save(filename);
}
