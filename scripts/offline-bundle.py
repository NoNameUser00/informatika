# Собирает Informatika-all.zip из четырёх офлайн-архивов (zip--of-zips).
# Ничего не компилирует — только упаковывает уже собранное, чтобы учитель
# скачал всё одним файлом.
import io, os, zipfile

here = os.path.dirname(os.path.abspath(__file__))
release = os.path.join(os.path.dirname(here), "release")  # release/ рядом со scripts/
parts = [
    "Informatika-uchenik-windows.zip",
    "Informatika-uchenik-rosa.zip",
    "Informatika-uchitel-windows.zip",
    "Informatika-uchitel-rosa.zip",
]
out = os.path.join(release, "Informatika-all.zip")

missing = [p for p in parts if not os.path.isfile(os.path.join(release, p))]
if missing:
    raise SystemExit("Нет архивов: " + ", ".join(missing))

with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for p in parts:
        z.write(os.path.join(release, p), p)

print("OK", out, round(os.path.getsize(out) / 1048576, 1), "MB")
with zipfile.ZipFile(out) as z:
    for i in z.infolist():
        print("  ", i.filename, round(i.file_size / 1048576, 1), "MB")