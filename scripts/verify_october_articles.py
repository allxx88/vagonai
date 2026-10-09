"""Check the 50 source articles against an actual Hugo build."""

import json
import re
import sys
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.depth = 0
        self.prose_depth = None
        self.text = []
        self.links = []
        self.images = []
        self.h1 = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "h1":
            self.h1 += 1
        if tag == "div":
            self.depth += 1
            if "blog-prose" in attrs.get("class", "").split():
                self.prose_depth = self.depth
        if self.prose_depth is not None:
            if tag in ("p", "li", "h2", "h3", "ul", "ol", "table", "tr"):
                self.text.append(" ")
            if tag == "a":
                self.links.append(attrs["href"])
            if tag == "img":
                self.images.append(attrs["src"])

    def handle_endtag(self, tag):
        if self.prose_depth is not None and tag in ("p", "li", "h2", "h3"):
            self.text.append(" ")
        if tag == "div":
            if self.depth == self.prose_depth:
                self.prose_depth = None
            self.depth -= 1

    def handle_data(self, data):
        if self.prose_depth is not None:
            self.text.append(data)


def verify(build):
    manifest = json.loads((ROOT / "docs/new-articles-50-manifest.json").read_text())
    urls = (ROOT / "docs/yandex-reindex-50.txt").read_text().splitlines()
    assert len(manifest) == len(set(urls)) == 50
    assert urls == [m["url"] for m in manifest]
    sitemap = ET.parse(build / "sitemap.xml")
    listed = [e.text for e in sitemap.findall(".//{*}loc")]
    assert len(listed) == len(set(listed)), "Duplicate sitemap entries"
    records = []
    for m in manifest:
        source = (ROOT / m["source"]).read_text()
        assert 'editorial_batch: "october-2026-50"' in source
        assert m["url"] in listed, m["url"]
        page = Page()
        page.feed((build / "blog" / m["slug"] / "index.html").read_text())
        assert page.h1 == 1, (m["number"], page.h1)
        chars = len(re.sub(r"\s+", " ", "".join(page.text)).strip())
        assert chars >= 12000, (m["number"], chars)
        assert page.images, m["number"]
        # Sales contacts were removed at the user's request. Navigation and
        # relevant article links must still be present in the body.
        assert len(page.links) >= 3, m["number"]
        for image in page.images:
            path = unquote(urlsplit(image).path).lstrip("/")
            assert (ROOT / "static" / path).is_file(), image
            assert (build / path).is_file(), image
        for link in page.links:
            parsed = urlsplit(link)
            if parsed.scheme or not parsed.path.startswith("/"):
                continue
            target = build / unquote(parsed.path).lstrip("/")
            assert target.is_file() or (target / "index.html").is_file(), link
        backlinks = 0
        for old in (ROOT / "content/blog").glob("*.md"):
            if 'editorial_batch: "october-2026-50"' in old.read_text():
                continue
            if f"/blog/{m['slug']}/" in old.read_text():
                backlinks += 1
        assert backlinks >= 1, (m["number"], "No reciprocal link")
        records.append({"number": m["number"], "url": m["url"], "rendered_body_chars": chars,
                        "body_links": len(page.links), "existing_backlinks": backlinks})
    result = {"articles": 50, "sitemap_urls": len(listed),
              "minimum_rendered_chars": min(r["rendered_body_chars"] for r in records),
              "maximum_rendered_chars": max(r["rendered_body_chars"] for r in records),
              "checks": ["12,000+ visible characters", "one H1", "existing image assets",
                         "internal link destinations", "reciprocal links", "50 sitemap entries"],
              "pages": records}
    (ROOT / "docs/new-articles-50-validation.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({k: v for k, v in result.items() if k != "pages"}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    verify(Path(sys.argv[1]))
