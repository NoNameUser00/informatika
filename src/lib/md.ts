// Крошечный md -> html для уроков (заголовки, жирный, списки, код, таблицы не нужны).
// Полный MD-движок (remark) подключим при росте контента.
export function mdToHtml(src: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s: string) =>
    esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  const lines = src.split('\n');
  let html = '';
  let inList = false;
  let inCode = false;
  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      html += inCode ? '</code></pre>' : '<pre><code>';
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      html += esc(line) + '\n';
      continue;
    }
    if (/^#{1,3}\s/.test(line)) {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      const level = line.match(/^#+/)![0].length;
      html += `<h${level}>${inline(line.replace(/^#+\s*/, ''))}</h${level}>`;
    } else if (/^\s*[-*]\s+/.test(line)) {
      if (!inList) {
        html += '<ul>';
        inList = true;
      }
      html += `<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`;
    } else if (/^\s*\d+\.\s+/.test(line)) {
      if (!inList) {
        html += '<ul>';
        inList = true;
      }
      html += `<li>${inline(line.replace(/^\s*\d+\.\s+/, ''))}</li>`;
    } else if (line.trim() === '') {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
    } else {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      html += `<p>${inline(line)}</p>`;
    }
  }
  if (inList) html += '</ul>';
  return html;
}

export interface Slide {
  heading: string;
  html: string;
}

// Разбивка урока на слайды: титул (# ...) + по одному на каждый ## ....
// Возвращает заголовок страницы и массив слайдов (первый — титульный, без heading).
export function splitSlides(body: string): { title: string; slides: Slide[] } {
  const lines = body.split('\n');
  let title = '';
  const chunks: { heading: string; lines: string[] }[] = [];
  let cur: { heading: string; lines: string[] } | null = null;
  for (const line of lines) {
    const h1 = line.match(/^#\s+(.*)/);
    const h2 = line.match(/^##\s+(.*)/);
    if (h1 && !title) {
      title = h1[1].trim();
      cur = { heading: '', lines: [] };
      chunks.push(cur);
    } else if (h2) {
      cur = { heading: h2[1].trim(), lines: [] };
      chunks.push(cur);
    } else if (cur) {
      cur.lines.push(line);
    }
  }
  const slides = chunks
    .map((c) => ({ heading: c.heading, html: mdToHtml(c.lines.join('\n').trim()) }))
    .filter((s) => s.heading !== '' || s.html.replace(/<[^>]+>/g, '').trim() !== '');
  return { title, slides };
}

export function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {  const meta: Record<string, string> = {};
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { meta, body: raw };
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"|"$/g, '');
  }
  return { meta, body: m[2] };
}
