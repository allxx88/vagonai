<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# VAGONAI Hugo blog

Проект использует Hugo и GitHub Pages workflow из [`.github/workflows/hugo.yml`](/Users/allxx/Documents/SITE/vagonai/.github/workflows/hugo.yml).

## Локальный запуск

Требования: Hugo Extended, Python 3

1. Запустить сайт локально:
   `hugo server --bind 0.0.0.0 --port 3000 --disableFastRender`

## SEO-генерация статей через OpenAI

1. Создать `.env` на основе [`.env.example`](/Users/allxx/Documents/SITE/vagonai/.env.example) и указать `OPENAI_API_KEY`.
   При использовании OpenAI-совместимого провайдера можно также задать `OPENAI_BASE_URL`.
2. Посмотреть кластеры из `words.md`:
   `python3 scripts/seo_blog.py plan`
3. Сгенерировать один кластер примерно из 10 статей:
   `python3 scripts/seo_blog.py generate --batch 1`
4. При необходимости перезаписать существующие файлы:
   `python3 scripts/seo_blog.py generate --batch 1 --overwrite`

Что делает генератор:
- читает `words.md` и разбивает запросы по тематическим кластерам;
- создает статьи в `content/blog`;
- генерирует изображения через OpenAI и сохраняет их в `static/image` и `image`;
- вставляет картинку в markdown и добавляет внутренние ссылки на статьи текущего кластера.

## Автодеплой

Автодеплой выполняется Python-скриптом [deploy.py](/Users/allxx/Documents/SITE/vagonai/scripts/deploy.py).

Базовый запуск:
`python3 scripts/deploy.py --message "Deploy new blog cluster"`

Что делает скрипт:
- запускает `hugo --minify`;
- добавляет изменения в git;
- создает коммит;
- отправляет изменения в `origin/main`;
- GitHub Actions публикует сайт в GitHub Pages.

Если на машине уже работает git-аутентификация, GitHub token не нужен.
Переменная `GITHUB_TOKEN` нужна только как запасной вариант для https push.

## Публикация Кластера Одной Командой

Полный цикл генерации и деплоя выполняется скриптом [publish_cluster.py](/Users/allxx/Documents/SITE/vagonai/scripts/publish_cluster.py).

Базовый запуск:
`python3 scripts/publish_cluster.py --batch 1`

Примеры:
- `python3 scripts/publish_cluster.py --batch 1 --dry-run`
- `python3 scripts/publish_cluster.py --batch 1 --overwrite`
- `python3 scripts/publish_cluster.py --batch 1 --message "Publish blog batch 1"`

Что делает скрипт:
- запускает генерацию статей и изображений для выбранного кластера;
- затем запускает автодеплой;
- в обычном режиме выполняет `generate + build + commit + push`;
- в `--dry-run` проверяет сценарий деплоя без коммита и пуша.

## Деплой в GitHub Pages

Workflow уже настроен на деплой при пуше в `main`.

1. Собрать сайт:
   `hugo --minify`
2. Закоммитить изменения и отправить их в GitHub:
   `git add .`
   `git commit -m "Add generated blog articles"`
   `git push origin main`

После пуша GitHub Actions автоматически пересоберет Hugo и опубликует сайт в Pages.
