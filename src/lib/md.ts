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

export function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const meta: Record<string, string> = {};
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { meta, body: raw };
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"|"$/g, '');
  }
  return { meta, body: m[2] };
}
