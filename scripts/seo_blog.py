from __future__ import annotations

import argparse
import base64
import json
import os
import re
import ssl
import sys
from dataclasses import dataclass, asdict
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any
from urllib import error, parse, request


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent
WORDS_FILE = ROOT / "words.md"
BLOG_DIR = ROOT / "content" / "blog"
STATIC_IMAGE_DIR = ROOT / "static" / "image"
LOCAL_IMAGE_DIR = ROOT / "image"
PLAN_PATH = ROOT / "seo-plan.json"


def load_dotenv() -> None:
    env_path = ROOT / ".env"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("'").strip('"'))


load_dotenv()

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
OPENAI_BASE_URL = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
OPENAI_TEXT_MODEL = os.environ.get("OPENAI_TEXT_MODEL", "gpt-5")
OPENAI_IMAGE_MODEL = os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-1")
SITE_URL = os.environ.get("SITE_URL", "https://vagonai.ru").rstrip("/")
BATCH_SIZE = int(os.environ.get("BLOG_BATCH_SIZE", "10"))
OPENAI_CA_BUNDLE = os.environ.get("OPENAI_CA_BUNDLE")
OPENAI_SKIP_SSL_VERIFY = os.environ.get("OPENAI_SKIP_SSL_VERIFY", "").lower() in {
    "1",
    "true",
    "yes",
}


@dataclass
class Section:
    name: str
    queries: list[str]


@dataclass
class Batch:
    id: int
    section: str
    queries: list[str]


@dataclass
class PlannedArticle:
    keyword: str
    title: str
    description: str
    angle: str
    slug: str
    filename: str
    url: str
    related_slugs: list[str]


def slugify_russian(value: str) -> str:
    slug = value.lower().replace("ё", "е")
    slug = re.sub(r"""["'«»()!?.,:+/\\]+""", " ", slug)
    slug = re.sub(r"[^a-zа-я0-9\s-]", " ", slug, flags=re.IGNORECASE)
    slug = re.sub(r"\s+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    return slug.strip("-")


def title_from_keyword(keyword: str) -> str:
    return keyword[:1].upper() + keyword[1:] if keyword else keyword


def current_iso_date() -> str:
    now = datetime.now().astimezone()
    offset = now.utcoffset() or timedelta()
    sign = "+" if offset >= timedelta() else "-"
    total_minutes = int(abs(offset.total_seconds()) // 60)
    hours, minutes = divmod(total_minutes, 60)
    return f"{now.strftime('%Y-%m-%dT%H:%M:%S')}{sign}{hours:02d}:{minutes:02d}"


def read_words_sections() -> list[Section]:
    raw = WORDS_FILE.read_text(encoding="utf-8")
    lines = [line.strip() for line in raw.splitlines() if line.strip()]

    sections: list[Section] = []
    current: Section | None = None

    for line in lines:
        if re.match(r"^[A-ZА-ЯЁ]", line):
            current = Section(name=line, queries=[])
            sections.append(current)
            continue

        if current is None:
            current = Section(name="Без категории", queries=[])
            sections.append(current)

        current.queries.append(line)

    return [section for section in sections if section.queries]


def create_batches(sections: list[Section]) -> list[Batch]:
    batches: list[Batch] = []
    batch_id = 1

    for section in sections:
        for start in range(0, len(section.queries), BATCH_SIZE):
            batches.append(
                Batch(
                    id=batch_id,
                    section=section.name,
                    queries=section.queries[start : start + BATCH_SIZE],
                )
            )
            batch_id += 1

    return batches


def ensure_api_key() -> None:
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is not set. Add it to your environment before generation.")


def build_ssl_context() -> ssl.SSLContext:
    if OPENAI_SKIP_SSL_VERIFY:
        return ssl._create_unverified_context()

    cafile = OPENAI_CA_BUNDLE or os.environ.get("SSL_CERT_FILE")
    if cafile:
        return ssl.create_default_context(cafile=cafile)

    return ssl.create_default_context()


def openai_request(pathname: str, payload: dict[str, Any]) -> dict[str, Any]:
    ensure_api_key()
    url = f"{OPENAI_BASE_URL}{pathname}"
    body = json.dumps(payload).encode("utf-8")
    ssl_context = build_ssl_context()
    req = request.Request(
        url,
        data=body,
        headers={
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with request.urlopen(req, context=ssl_context) as response:
            return json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"OpenAI API error {exc.code}: {details}") from exc
    except error.URLError as exc:
        reason = str(exc.reason)
        if "CERTIFICATE_VERIFY_FAILED" in reason:
            raise RuntimeError(
                "SSL certificate verification failed. On macOS with python.org Python, "
                "run 'Install Certificates.command' once, or set OPENAI_CA_BUNDLE=/path/to/cacert.pem. "
                "For a temporary insecure workaround only, set OPENAI_SKIP_SSL_VERIFY=true."
            ) from exc
        raise RuntimeError(f"OpenAI API request failed: {exc.reason}") from exc


def extract_output_text(data: dict[str, Any]) -> str:
    output_text = data.get("output_text")
    if isinstance(output_text, str) and output_text.strip():
        return output_text

    output = data.get("output", [])
    chunks: list[str] = []
    if isinstance(output, list):
        for item in output:
            if not isinstance(item, dict):
                continue
            content = item.get("content", [])
            if not isinstance(content, list):
                continue
            for entry in content:
                if isinstance(entry, dict) and isinstance(entry.get("text"), str):
                    chunks.append(entry["text"])

    joined = "\n".join(chunks).strip()
    if joined:
        return joined

    raise RuntimeError("Could not extract text from OpenAI response.")


def response_json_schema(name: str, schema: dict[str, Any]) -> dict[str, Any]:
    return {
        "format": {
            "type": "json_schema",
            "name": name,
            "strict": True,
            "schema": schema,
        }
    }


def plan_batch(batch: Batch) -> list[PlannedArticle]:
    schema = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "articles": {
                "type": "array",
                "minItems": len(batch.queries),
                "maxItems": len(batch.queries),
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "keyword": {"type": "string"},
                        "title": {"type": "string"},
                        "description": {"type": "string"},
                        "angle": {"type": "string"},
                    },
                    "required": ["keyword", "title", "description", "angle"],
                },
            }
        },
        "required": ["articles"],
    }

    data = openai_request(
        "/responses",
        {
            "model": OPENAI_TEXT_MODEL,
            "instructions": (
                "Ты сильный русскоязычный SEO-редактор для B2B-сайта о грузовых железнодорожных "
                "вагонах. Верни только JSON по схеме. Для каждого ключевого запроса придумай "
                "естественный, коммерчески сильный title и concise description без кликбейта. "
                "Не меняй сам keyword."
            ),
            "input": "Раздел: {section}\nКлючевые запросы:\n{queries}".format(
                section=batch.section,
                queries="\n".join(f"{index + 1}. {query}" for index, query in enumerate(batch.queries)),
            ),
            "text": response_json_schema("article_batch_plan", schema),
        },
    )

    parsed = json.loads(extract_output_text(data))
    articles: list[PlannedArticle] = []

    for article in parsed["articles"]:
        slug = slugify_russian(article["keyword"])
        articles.append(
            PlannedArticle(
                keyword=article["keyword"],
                title=article["title"].strip() or title_from_keyword(article["keyword"]),
                description=article["description"].strip(),
                angle=article["angle"].strip(),
                slug=slug,
                filename=f"{slug}.md",
                url=f"{SITE_URL}/blog/{parse.quote(slug)}/",
                related_slugs=[],
            )
        )

    for article in articles:
        article.related_slugs = [
            candidate.slug for candidate in articles if candidate.slug != article.slug
        ][:4]

    return articles


def read_existing_blog_articles() -> list[PlannedArticle]:
    sections = read_words_sections()
    queries = [query for section in sections for query in section.queries]
    articles: list[PlannedArticle] = []

    for keyword in queries:
        slug = slugify_russian(keyword)
        articles.append(
            PlannedArticle(
                keyword=keyword,
                title=title_from_keyword(keyword),
                description="",
                angle="",
                slug=slug,
                filename=f"{slug}.md",
                url=f"{SITE_URL}/blog/{parse.quote(slug)}/",
                related_slugs=[],
            )
        )

    return articles


def build_internal_links_section(
    current: PlannedArticle,
    cluster_articles: list[PlannedArticle],
    existing_articles: list[PlannedArticle],
) -> str:
    related = [article for article in cluster_articles if article.slug in current.related_slugs]
    fallback = [article for article in existing_articles if article.slug != current.slug]
    links = (related + fallback)[:4]

    if not links:
        return ""

    rows = "\n".join(f"- [{article.title}]({article.url})" for article in links)
    return f"\n## Читайте также\n\n{rows}\n"


def escape_yaml(value: str) -> str:
    normalized = re.sub(r"\r?\n", " ", value).strip()
    if ":" in normalized or "'" in normalized:
        return "'" + normalized.replace("'", "''") + "'"
    return normalized


def inject_image_after_lead(markdown: str, image_block: str) -> str:
    chunks = re.split(r"\n{2,}", markdown.strip())
    if len(chunks) < 2:
        return f"{markdown.strip()}\n\n{image_block}\n"

    head = "\n\n".join(chunks[:2]).strip()
    tail = "\n\n".join(chunks[2:]).strip()
    if not tail:
        return f"{head}\n\n{image_block}\n"

    return f"{head}\n\n{image_block}\n\n{tail}\n"


def draft_article(
    article: PlannedArticle,
    batch: Batch,
    cluster_articles: list[PlannedArticle],
    existing_articles: list[PlannedArticle],
) -> tuple[str, str]:
    related_links_text = "\n".join(
        f"- {candidate.title}: {candidate.url}"
        for candidate in cluster_articles
        if candidate.slug in article.related_slugs
    ) or "- нет"

    schema = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "title": {"type": "string"},
            "description": {"type": "string"},
            "imageAlt": {"type": "string"},
            "imagePrompt": {"type": "string"},
            "markdown": {"type": "string"},
        },
        "required": ["title", "description", "imageAlt", "imagePrompt", "markdown"],
    }

    data = openai_request(
        "/responses",
        {
            "model": OPENAI_TEXT_MODEL,
            "instructions": (
                "Ты пишешь SEO-статью для Hugo CMS на русском языке. Верни только JSON по схеме. "
                "Статья должна быть экспертной, понятной, полезной для AI-поиска и классического SEO. "
                "Не придумывай непроверяемые числовые характеристики, если их нет во входных данных. "
                "Структура: сильный H1, короткое введение, логичные H2/H3, списки, таблицы там где "
                "уместно, блок о выборе/покупке/поставке, блок о факторах цены, блок о рисках и советах, "
                "в конце раздел 'Вопросы и ответы' минимум с 6 вопросами. Объем markdown-тела: примерно "
                "12000-16000 символов. Не включай frontmatter. Не вставляй изображение и блок внутренних "
                "ссылок, их добавит приложение. Упоминай компанию VAGONAI естественно, без переспама."
            ),
            "input": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_text",
                            "text": "\n".join(
                                [
                                    f"Раздел кластера: {batch.section}",
                                    f"Основной запрос: {article.keyword}",
                                    f"SEO title: {article.title}",
                                    f"SEO description: {article.description}",
                                    f"Редакционный угол: {article.angle}",
                                    "",
                                    "Соседние статьи для перелинковки:",
                                    related_links_text,
                                    "",
                                    "Требования к статье:",
                                    "- без воды и шаблонных фраз",
                                    "- ориентация на коммерческий и информационный интент одновременно",
                                    "- акцент на покупку, поставку с завода, теххарактеристики, области применения и подбор",
                                    "- в тексте допустимо естественно ссылаться на другие типы вагонов и комплектующие",
                                    "- в конце обязательно раздел FAQ",
                                    "- стиль: экспертный B2B, русский язык",
                                ]
                            ),
                        }
                    ],
                }
            ],
            "text": response_json_schema("article_draft", schema),
        },
    )

    draft = json.loads(extract_output_text(data))
    image_path = f"/image/{article.slug}.png"
    image_block = f"![{draft['imageAlt']}]({image_path})"
    links_block = build_internal_links_section(article, cluster_articles, existing_articles)
    body = draft["markdown"].strip()

    frontmatter = "\n".join(
        [
            "---",
            f"title: {escape_yaml(draft['title'].strip() or article.title)}",
            f"description: {escape_yaml(draft['description'].strip() or article.description)}",
            f"date: {current_iso_date()}",
            "draft: false",
            "---",
            "",
        ]
    )

    merged_markdown = inject_image_after_lead(body, image_block)
    return draft["imagePrompt"], f"{frontmatter}{merged_markdown}\n{links_block}"


def generate_image(prompt: str) -> bytes:
    data = openai_request(
        "/images/generations",
        {
            "model": OPENAI_IMAGE_MODEL,
            "prompt": prompt,
            "size": "1536x1024",
            "quality": "medium",
        },
    )
    image = data.get("data", [{}])[0].get("b64_json")
    if not isinstance(image, str):
        raise RuntimeError("OpenAI Images API did not return image data.")
    return base64.b64decode(image)


def ensure_directories() -> None:
    BLOG_DIR.mkdir(parents=True, exist_ok=True)
    STATIC_IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    LOCAL_IMAGE_DIR.mkdir(parents=True, exist_ok=True)


def write_plan_file(batches: list[Batch]) -> None:
    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "batchSize": BATCH_SIZE,
        "batches": [asdict(batch) for batch in batches],
    }
    PLAN_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def print_plan() -> None:
    sections = read_words_sections()
    batches = create_batches(sections)
    write_plan_file(batches)

    print(f"Всего разделов: {len(sections)}")
    print(f"Всего кластеров: {len(batches)}")
    print(f"Размер кластера: {BATCH_SIZE}")
    print("")

    for batch in batches:
        print(f"[batch {batch.id}] {batch.section}")
        for query in batch.queries:
            print(f"- {query}")
        print("")

    print(f"План сохранен в {PLAN_PATH}")


def generate_batch(batch_id: int, overwrite: bool) -> None:
    sections = read_words_sections()
    batches = create_batches(sections)
    batch = next((candidate for candidate in batches if candidate.id == batch_id), None)

    if batch is None:
        raise RuntimeError(f'Batch {batch_id} was not found. Run "plan" to inspect available batches.')

    ensure_directories()

    cluster_articles = plan_batch(batch)
    existing_articles = read_existing_blog_articles()

    for article in cluster_articles:
        content_path = BLOG_DIR / article.filename
        static_image_path = STATIC_IMAGE_DIR / f"{article.slug}.png"
        local_image_path = LOCAL_IMAGE_DIR / f"{article.slug}.png"

        if not overwrite and content_path.exists():
            print(f"skip {article.filename} (already exists)")
            continue

        print(f"generate {article.filename}")
        image_prompt, final_markdown = draft_article(article, batch, cluster_articles, existing_articles)
        image_data = generate_image(image_prompt)

        content_path.write_text(final_markdown, encoding="utf-8")
        static_image_path.write_bytes(image_data)
        local_image_path.write_bytes(image_data)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Generate Hugo SEO blog content from words.md")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("plan", help="Print keyword clusters and save seo-plan.json")

    generate_parser = subparsers.add_parser("generate", help="Generate one article batch")
    generate_parser.add_argument("--batch", type=int, required=True, help="Batch id from the plan output")
    generate_parser.add_argument("--overwrite", action="store_true", help="Overwrite existing markdown files")

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    if args.command == "plan":
        print_plan()
        return 0

    if args.command == "generate":
        generate_batch(args.batch, args.overwrite)
        return 0

    parser.error(f"Unknown command: {args.command}")
    return 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)
