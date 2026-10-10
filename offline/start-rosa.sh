#!/bin/sh
# Офлайн-версия «Информатика»: локальный сервер для класса (Rosa OS Mostex 12).
# Открывает сайт в браузере. Остановка — Ctrl+C в этом окне.
cd "$(dirname "$0")" || exit 1
if ! command -v python3 >/dev/null 2>&1; then
  echo "Нужен python3 (обычно уже есть в образе). Попроси учителя установить его."
  exit 1
fi
(xdg-open http://localhost:8000/ >/dev/null 2>&1 || true) &
python3 -m http.server 8000
