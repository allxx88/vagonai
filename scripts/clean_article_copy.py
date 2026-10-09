"""Remove contacts and search-promotion editorial notes from article copy."""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTACT = re.compile(r"mailto:|tel:|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\+7[ (]", re.I)
PROMOTION = re.compile(r"\bSEO\b|\bSEO[- ]|\bАлис[а-я]*|\bAI[- ](?:поиск|выдач|ответ)|\bИИ[- ](?:поиск|ответ)|оптимизирован[а-я]*\s+для", re.I)


def clean_body(body):
    body = re.sub(r"^# [^\n]+\n+", "", body, flags=re.M)
    body = re.sub(r"^## (?:Почему запрос[^\n]*коммерческий интент|Как статья помогает[^\n]*)\n.*?(?=^## |\Z)", "", body, flags=re.M | re.S)
    body = re.sub(r"^## Короткий ответ для ИИ-поиска", "## Что важно при выборе", body, flags=re.M)
    body = re.sub(r"^## Вопросы и ответы для Яндекс Алисы и AI-поиска", "## Вопросы перед покупкой", body, flags=re.M)
    blocks = []
    for paragraph in body.split("\n\n"):
        if CONTACT.search(paragraph):
            continue
        if PROMOTION.search(paragraph):
            if paragraph.lstrip().startswith("#"):
                continue
            sentences = re.split(r"(?<=[.!?])\s+(?=[А-ЯЁA-Z])", paragraph)
            paragraph = " ".join(s for s in sentences if not PROMOTION.search(s))
        if paragraph.strip():
            blocks.append(paragraph.strip())
    return "\n\n".join(blocks) + "\n"


def clean_file(path):
    original = path.read_text()
    _, front, body = original.split("---", 2)
    match = re.search(r'^description:\s*"(.*)"\s*$', front, re.M)
    if match:
        description = match[1]
        description = re.sub(r"\s*Практический гид:.*", "", description)
        sentences = re.split(r"(?<=[.!?])\s+(?=[А-ЯЁA-Z])", description)
        description = " ".join(s for s in sentences if not PROMOTION.search(s) and not CONTACT.search(s))
        front = front[:match.start()] + "description: " + json.dumps(description, ensure_ascii=False) + front[match.end():]
    result = "---" + front + "---\n\n" + clean_body(body)
    if result != original:
        front = re.sub(r"^lastmod:.*\n", "", front, flags=re.M)
        result = "---" + front + 'lastmod: "2026-10-09T09:25:00+03:00"\n---\n\n' + clean_body(body)
        path.write_text(result)
        return True
    return False


if __name__ == "__main__":
    changed = sum(clean_file(p) for p in (ROOT / "content/blog").glob("*.md"))
    print(f"Cleaned {changed} article files")
