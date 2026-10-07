# VAGONAI / ПРОВАГОН: восстановление сайта и сервера с нуля

Инструкция для Ubuntu с графической сессией GNOME и пользователем `allxx`.
Она описывает проверенную в этом проекте схему: NekoBox/TUN → ngrok → n8n
в Docker → обновление JSON через GitHub API → публикация Hugo в GitHub Pages.
Дата инструкции: 5 октября 2026 года.

Если имя пользователя, репозиторий или домен отличаются, замените их во всех
примерах. Команды выполняются в терминале Ubuntu от обычного пользователя;
`sudo` используется только там, где явно указан. Блоки содержимого файлов
вставляйте в редактор, а блоки команд выполняйте в терминале.

## 1. Как устроена система

```text
Перезагрузка Ubuntu → вход allxx в GNOME
                       ├─ автозапуск NekoBox и VPN/TUN
                       └─ пользовательский сервис ngrok-n8n.service
                           → получение публичного HTTPS URL ngrok
                           → обновление WEBHOOK_URL и N8N_EDITOR_BASE_URL
                           → пересоздание контейнера n8n
                           → запись static/api/endpoint.json в GitHub
                           → GitHub Actions собирает Hugo и публикует Pages
                           → чат читает api/endpoint.json перед сообщением
                           → POST /webhook/chat_vagon в n8n
```

Обновление GitHub подтверждено журналом после reboot и перезапуска сервиса.
Публикация Pages и работа самого AI workflow проверяются отдельно.
После изменения URL публикация занимает время; до её завершения сайт может
обращаться по старому адресу. Чтение JSON без кеша не устраняет задержку CDN.

| Компонент | Место хранения |
| --- | --- |
| Исходники сайта | Репозиторий `allxx88/vagonai`, ветка `main` |
| Главная страница | `provagon/index.html`, подключается через `layouts/index.html` |
| Webhook сайта | `static/api/endpoint.json` |
| Updater GitHub | `scripts/update_webhook.py` |
| Публикация | `.github/workflows/hugo.yml` |
| n8n Compose | `~/n8n/docker-compose.yml` |
| Данные n8n | Docker volume `n8n_data`, см. раздел резервных копий |
| Скрипт запуска | `~/.local/bin/update-n8n-ngrok-url.sh` |
| Установленный updater | `~/.local/bin/update-vagonai-webhook.py` |
| GitHub PAT | `~/.config/vagonai-webhook.env`, вне репозитория |
| Сервис | `~/.config/systemd/user/ngrok-n8n.service` |
| VPN автозапуск | `~/.config/autostart/nekoray.desktop` |

## 2. Что подготовить до переустановки

Для полного восстановления нужны:

- Копия репозитория сайта или доступ к GitHub.
- Установщик/архив той версии NekoBox, которую используете, и экспорт её
  профиля подключения: сервер, протокол, ключи, маршрутизация, DNS, TUN.
- Учётная запись ngrok и её **authtoken**.
- GitHub Personal Access Token (PAT) с доступом к репозиторию.
- Резервная копия данных n8n, его encryption key и Compose-конфигурации.
- Экспорт AI workflow, настройки внешних моделей/базы знаний и их credentials.
- Доступ к DNS домена `provagon.ru`, если восстанавливаете также домен.

GitHub-токен и ngrok-authtoken — разные ключи. Секреты не сохраняйте в git,
README или публичном JSON. Резервные копии с credentials храните отдельно.
В этом репозитории **нет экспорта рабочего AI workflow**: сайт и Docker
сами по себе его не восстановят. Без копии workflow потребуется собрать
AI-логику заново и подключить её внешние сервисы.

## 3. Базовые пакеты Ubuntu

```bash
sudo apt update
sudo apt install -y git curl ca-certificates python3 nano openssl
mkdir -p ~/.local/bin ~/.config/systemd/user ~/.config/autostart
```

## 4. VPN: восстановление NekoBox и TUN

На исходной машине установлены `/opt/nekoray/nekobox` и
`/opt/nekoray/nekobox_core`. Исходный [проект Nekoray](https://github.com/MatsuriDayo/nekoray)
больше не поддерживается. Эта инструкция описывает восстановление уже
используемой версии; конкретный архив и профиль нужно взять из резервной
копии или официальных releases, соответствующих вашей архитектуре.

1. Установите/распакуйте совместимую Linux-версию в `/opt/nekoray`.
2. Проверьте наличие исполняемого файла:

   ```bash
   test -x /opt/nekoray/nekobox && echo "NekoBox найден"
   ```

3. Запустите от пользователя `allxx`:

   ```bash
   /opt/nekoray/nekobox -appdata
   ```

4. Импортируйте профиль/подписку VPN. Включите нужный профиль и TUN.
   Разрешения для TUN настройте средствами вашей версии приложения.
5. В настройках приложения включите автоматическое подключение профиля и
   восстановление TUN при запуске. Названия пунктов зависят от версии.
   Сам автозапуск окна не гарантирует запуск VPN.
6. Проверьте соединение:

   ```bash
   pgrep -af 'nekobox|nekoray'
   curl -4 --max-time 10 https://ipinfo.io/ip
   curl --head --max-time 15 https://api.github.com
   ```

Сравните IP с ожидаемым выходным IP вашего VPN. Внешний IP может изменяться,
поэтому не фиксируйте IP из старого журнала как обязательное значение.

Создайте автозапуск:

```bash
nano ~/.config/autostart/nekoray.desktop
```

Содержимое:

```ini
[Desktop Entry]
Type=Application
Name=nekoray
Exec=/opt/nekoray/nekobox -tray -appdata
Terminal=false
X-GNOME-Autostart-enabled=true
```

Сначала проверьте VPN вручную. Позднее проверьте повторный вход в GNOME:
профиль и TUN должны подняться без ручного запуска.

### Linger и порядок запуска

```bash
loginctl show-user allxx -p Linger
```

В проверенной схеме используется `Linger=no`: VPN зависит от входа в GNOME.
Если linger был включён, для воспроизведения этой схемы:

```bash
sudo loginctl disable-linger allxx
```

Это влияет на все пользовательские сервисы этого пользователя. На машине,
где другие службы должны работать без входа, сначала оцените их зависимости.
`Linger=no` не создаёт строгую зависимость ngrok от NekoBox: оба могут
запускаться одновременно. Ниже используются задержка, ожидание URL и
повторные запуски ngrok. После reboot нужен вход в GNOME. Для запуска сервера
без графического входа потребуется отдельная настройка VPN как системной
службы и зависимостей; она не входит в эту проверенную конфигурацию.

## 5. Docker Engine и Compose

Для чистой Ubuntu установите Engine из официального apt-репозитория.
Если Docker уже работает, не переустанавливайте его: проверьте команды в
конце раздела. Для существующих конфликтующих пакетов используйте
[инструкцию Docker](https://docs.docker.com/engine/install/ubuntu/).

```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
```

```bash
sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
```

```bash
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker allxx
```

Выйдите из GNOME и войдите снова: новые группы должны примениться также к
пользовательскому systemd. Доступ к группе `docker` даёт широкие права на
машине; здесь он необходим для запуска Compose из пользовательского сервиса.

```bash
docker info
docker compose version
```

Обе команды должны работать без `sudo`.

## 6. Получение исходников сайта и настройка Git

```bash
mkdir -p ~/Документы/PY/SITES/PROVAGON
cd ~/Документы/PY/SITES/PROVAGON
git clone https://github.com/allxx88/vagonai.git
cd vagonai
```

Если восстанавливаете новый репозиторий, загрузите в него полную резервную
копию сайта и настройте `origin` на его URL. Один README не заменяет исходники.
При изменении owner/repository поправьте параметры updater (раздел 11).

Настройте автора коммитов для этого проекта:

```bash
git config user.name "allxx88"
git config user.email "ВАШ_EMAIL_В_GITHUB"
```

Замените email своим адресом GitHub или предоставленным GitHub noreply-адресом.

```bash
git status
git log -1 --oneline
git remote -v
git show HEAD:static/api/endpoint.json
```

Последняя команда должна вывести JSON. Файл на диске, которого нет в `HEAD`,
ещё не закоммичен. `Everything up-to-date` означает только отсутствие новых
локальных коммитов, а не публикацию незакоммиченных файлов.

## 7. GitHub-токен и первая публикация Pages

В GitHub: Settings → Developer settings → Personal access tokens →
Fine-grained tokens → Generate new token.

Укажите владельца `allxx88`, репозиторий `vagonai` и **Contents: Read and write**.
Для обновления JSON этого разрешения достаточно; изменение workflow-файлов
через тот же fine-grained токен требует также **Workflows: Read and write**.
Проверьте срок действия токена и правила записи в `main`.
[Описание API GitHub](https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents).

После локальных изменений сначала проверьте `git status`, затем добавьте
только нужные файлы, создайте коммит и отправьте его:

```bash
git add README.md
git commit -m "Update recovery instructions"
git -c credential.helper= push origin main
```

В запросе Username введите `allxx88`, в Password вставьте **токен**, а не
пароль аккаунта. Символы при вводе не отображаются; вставка в терминале
Ubuntu обычно `Ctrl+Shift+V`. Если изменений нет, коммит не требуется.

В репозитории: Settings → Pages → Build and deployment → Source →
**GitHub Actions**. Workflow `.github/workflows/hugo.yml` уже выполняет сборку
и публикацию при push в `main` и поддерживает ручной запуск. Не заменяйте
его настройкой публикации только папки `public` из ветки.
[Настройка Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

В Settings → Pages восстановите Custom domain `provagon.ru`, DNS по подсказкам
GitHub и HTTPS. Домен должен принадлежать вам. Если используете другой домен,
поправьте `hugo.toml`, CORS workflow n8n и адреса проверок в этой инструкции.
Главная страница содержит пути от корня сайта; при публикации на
`allxx88.github.io/vagonai/` отдельно проверьте и адаптируйте ссылки/ресурсы
для подпапки. Проверенная схема использует домен без подпапки.

Дождитесь зелёного результата в [Actions](https://github.com/allxx88/vagonai/actions).

```bash
curl --fail --location https://raw.githubusercontent.com/allxx88/vagonai/main/static/api/endpoint.json
curl --fail --location "https://provagon.ru/api/endpoint.json?t=$(date +%s)"
```

Оба запроса должны возвращать JSON с `webhook_url`. Первый проверяет GitHub,
второй — публикацию Pages.

## 8. ngrok: установка и ручная проверка

В проверенной конфигурации ngrok установлен через snap и запускается как
`/snap/bin/ngrok`. Для того же расположения:

```bash
sudo apt install -y snapd
sudo snap install ngrok
/snap/bin/ngrok version
/snap/bin/ngrok config add-authtoken "ВАШ_NGROK_AUTHTOKEN"
```

Токен возьмите в своём [кабинете ngrok](https://dashboard.ngrok.com/get-started/your-authtoken).
Авторизация должна выполняться **без sudo**, от пользователя `allxx`.
Команда с токеном может остаться в истории терминала.
Если snap-пакет недоступен, установите ngrok по
[официальной инструкции](https://ngrok.com/download/linux) и замените путь
`ExecStart` сервиса фактическим абсолютным путём из `command -v ngrok`.

На этом шаге VPN уже должен работать. Пока не создавайте второй туннель,
если уже запущен существующий ngrok-сервис.

Для ручного запуска после настройки n8n в следующем разделе:

```bash
/snap/bin/ngrok http 5678 --log=stdout
```

В другом терминале:

```bash
curl --fail --silent http://127.0.0.1:4040/api/tunnels | python3 -m json.tool
```

Запишите `public_url` HTTPS-туннеля. Не используйте старый адрес из переписки.
Постоянный домен ngrok можно использовать отдельно, если он доступен в вашем
аккаунте; здесь документируется уже реализованное обновление динамического URL.

## 9. n8n: Compose, данные и webhook

### Новая установка

Для восстановления существующего n8n сначала прочитайте раздел 15: его данные
и ключ шифрования нужно вернуть до запуска. Следующий пример — для новой базы.

```bash
mkdir -p ~/n8n
cd ~/n8n
nano .env
```

Содержимое `.env`:

```ini
N8N_IMAGE=docker.n8n.io/n8nio/n8n:latest
N8N_ENCRYPTION_KEY=ЗАМЕНИТЕ_НА_ПОСТОЯННЫЙ_СЛУЧАЙНЫЙ_КЛЮЧ
```

Для новой установки сгенерируйте ключ:

```bash
openssl rand -hex 32
```

Вставьте результат вместо заглушки. Для восстановленных credentials нужен
**прежний** ключ; новый ключ не расшифрует прежние данные.
После проверки версии замените `latest` конкретным тегом работающей версии:
при восстановлении предпочтительна та же версия, что была в резервной копии.

```bash
chmod 600 ~/n8n/.env
nano ~/n8n/docker-compose.yml
```

Полный минимальный Compose:

```yaml
services:
  n8n:
    image: ${N8N_IMAGE}
    container_name: n8n
    restart: unless-stopped
    ports:
      - "127.0.0.1:5678:5678"
    environment:
      - N8N_PORT=5678
      - NODE_ENV=production
      - GENERIC_TIMEZONE=Europe/Moscow
      - TZ=Europe/Moscow
      - N8N_ENCRYPTION_KEY=${N8N_ENCRYPTION_KEY}
      - N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=true
      - N8N_PROXY_HOPS=1
      - WEBHOOK_URL=https://replace-me.ngrok-free.app/
      - N8N_EDITOR_BASE_URL=https://replace-me.ngrok-free.app/
    volumes:
      - n8n_data:/home/node/.n8n

volumes:
  n8n_data:
    name: n8n_data
```

Адрес `replace-me` — только заглушка, которую заменит скрипт. Восстановление
старого volume с другим именем требует указать его фактическое имя в Compose.
Порт 5678 слушает только localhost; внешний HTTPS предоставляет ngrok.

```bash
cd ~/n8n
docker compose config --quiet
docker compose up -d
docker compose ps
docker compose logs --tail 50 n8n
```

Откройте `http://127.0.0.1:5678` на этой машине, создайте владельца n8n и
восстановите рабочий workflow/credentials либо создайте новый.
Теперь выполните ручную проверку ngrok из раздела 8.

### Контракт workflow сайта

Webhook node должен принимать **POST**, Path: **`chat_vagon`**.
Используйте production URL `/webhook/chat_vagon`, а не `/webhook-test/...`.
Workflow должен быть активирован/опубликован в вашей версии n8n.

Тело запроса сайта:

```json
{
  "query": "Помогите выбрать вагон",
  "chat_history": [
    {"role": "user", "content": "Помогите выбрать вагон"}
  ]
}
```

В узле Webhook данные обычно доступны в `$json.body.query` и
`$json.body.chat_history`. Подключите вашу AI-логику. Верните ответ в JSON,
например через Respond to Webhook с соответствующим режимом ответа Webhook:

```json
{"answer": "Текст ответа помощника"}
```

Задайте CORS для фактических доменов сайта, включая `https://provagon.ru` и
`https://www.provagon.ru`, если он используется. Запрос OPTIONS должен
разрешать POST и заголовки `Content-Type`, `ngrok-skip-browser-warning`.
Используйте настройки Allowed Origins и нужные response headers вашей версии
n8n/прокси. Одного успешного curl недостаточно: браузер дополнительно проверяет
CORS. Не защищайте публичный endpoint токеном, который затем попадёт в JS сайта.

[Webhook node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/)
описывает production/test URL и настройки ответа.

## 10. Установка updater GitHub и токена

```bash
cd ~/Документы/PY/SITES/PROVAGON/vagonai
mkdir -p ~/.local/bin ~/.config
cp scripts/update_webhook.py ~/.local/bin/update-vagonai-webhook.py
python3 ~/.local/bin/update-vagonai-webhook.py --help
nano ~/.config/vagonai-webhook.env
```

Содержимое файла:

```ini
WEBHOOK_GITHUB_TOKEN=ВАШ_РАБОЧИЙ_GITHUB_PAT
```

Без пробелов вокруг `=`. Не используйте токен ngrok.

```bash
chmod 600 ~/.config/vagonai-webhook.env
python3 ~/.local/bin/update-vagonai-webhook.py --dry-run
```

Если API ngrok не позволяет однозначно выбрать туннель на порт 5678:

```bash
python3 ~/.local/bin/update-vagonai-webhook.py --url https://ВАШ_АДРЕС.ngrok-free.app --dry-run
```

Первое настоящее обновление:

```bash
set -a
. ~/.config/vagonai-webhook.env
set +a
python3 ~/.local/bin/update-vagonai-webhook.py
```

Ожидается `Webhook updated. Pages deployment will run for commit ...` либо
`Webhook already current; no commit needed.`. Updater использует только
стандартную библиотеку Python. PAT создаёт коммит в `main`, после которого
запускается существующий Pages workflow. Токен `GITHUB_TOKEN` другой GitHub
Action не является равноценной заменой PAT для этой цепочки push.
[Поведение GITHUB_TOKEN](https://docs.github.com/en/actions/concepts/security/github_token).

## 11. Полный скрипт ngrok → n8n → GitHub

Создайте файл:

```bash
nano ~/.local/bin/update-n8n-ngrok-url.sh
```

Вставьте полностью:

```bash
#!/usr/bin/env bash
set -euo pipefail

N8N_DIR="$HOME/n8n"
COMPOSE_FILE="$N8N_DIR/docker-compose.yml"
NGROK_API="http://127.0.0.1:4040/api/tunnels"

echo "[ngrok→n8n] Ожидаю публичный URL ngrok..."
URL=""

for i in $(seq 1 60); do
    URL=$(curl -fsS --max-time 5 "$NGROK_API" 2>/dev/null \
        | grep -o 'https://[^"]*\.ngrok-free\.app' \
        | head -n1 || true)
    if [ -n "$URL" ]; then
        break
    fi
    sleep 2
done

if [ -z "$URL" ]; then
    echo "[ngrok→n8n] ERROR: Не удалось получить URL ngrok"
    exit 1
fi

echo "[ngrok→n8n] Новый URL: $URL"
cp "$COMPOSE_FILE" "$COMPOSE_FILE.bak"
sed -i -E \
    "/WEBHOOK_URL|N8N_EDITOR_BASE_URL/ s#https://[^/[:space:]]+\.ngrok-free\.app/?#${URL}/#g" \
    "$COMPOSE_FILE"

echo "[ngrok→n8n] Текущие настройки:"
grep -E 'WEBHOOK_URL|N8N_EDITOR_BASE_URL' "$COMPOSE_FILE"
echo "[ngrok→n8n] Ожидаю Docker..."
DOCKER_READY=0

for i in $(seq 1 60); do
    if timeout 5 docker info >/dev/null 2>&1; then
        DOCKER_READY=1
        break
    fi
    sleep 2
done

if [ "$DOCKER_READY" -ne 1 ]; then
    echo "[ngrok→n8n] ERROR: Docker недоступен"
    exit 1
fi

cd "$N8N_DIR"
echo "[ngrok→n8n] Проверяю docker-compose..."
docker compose -f "$COMPOSE_FILE" config --quiet
echo "[ngrok→n8n] Пересоздаю n8n..."
docker compose -f "$COMPOSE_FILE" up -d --force-recreate n8n

echo "[ngrok→сайт] Обновляю webhook в GitHub..."
if /usr/bin/python3 "$HOME/.local/bin/update-vagonai-webhook.py" --url "$URL"; then
    echo "[ngrok→сайт] Webhook в GitHub актуален."
else
    echo "[ngrok→сайт] ВНИМАНИЕ: Не удалось обновить webhook сайта."
    echo "[ngrok→сайт] После устранения ошибки повторите запуск updater."
fi

echo "[ngrok→n8n] Готово."
```

```bash
chmod +x ~/.local/bin/update-n8n-ngrok-url.sh
bash -n ~/.local/bin/update-n8n-ngrok-url.sh
```

Отсутствие вывода означает корректный синтаксис. Скрипт рассчитан на один
туннель с доменом `ngrok-free.app` и строки URL непосредственно в Compose,
как в разделе 9. Для другого суффикса/домена адаптируйте поиск и замену URL.
Начальные URL другого хостинга этот sed не заменит автоматически.
`Started` контейнера ещё не означает готовность AI workflow отвечать.

Для нового репозитория добавьте к Python-команде `--repo OWNER/REPO --branch main`.
Такие же параметры используйте при ручном запуске updater.

## 12. Полный пользовательский systemd-сервис

Если ручной ngrok ещё работает, остановите его `Ctrl+C` перед запуском сервиса.
Не запускайте одновременно два агента на одном локальном API/туннеле.

```bash
nano ~/.config/systemd/user/ngrok-n8n.service
```

Содержимое для чистой установки:

```ini
[Unit]
Description=ngrok tunnel for n8n and website webhook update
After=network-online.target
StartLimitIntervalSec=0

[Service]
Type=simple
EnvironmentFile=%h/.config/vagonai-webhook.env
ExecStartPre=/bin/sleep 15
ExecStart=/snap/bin/ngrok http 5678 --log=stdout
ExecStartPost=%h/.local/bin/update-n8n-ngrok-url.sh
TimeoutStartSec=15min
Restart=always
RestartSec=10

[Install]
WantedBy=default.target
```

`TimeoutStartSec` оставляет время для ожидания ngrok и Docker: длительный
`ExecStartPost` иначе может превысить стандартный таймаут запуска. Этот сервис
не проверяет конкретный VPN IP и не гарантирует строгую очередность GNOME/VPN.
Повторные запуски помогают при временном отсутствии сети, но не исправляют
неверный профиль VPN, отсутствующий токен или ошибку Compose.

При восстановлении поверх старой установки проверьте также override-файлы:

```bash
systemctl --user cat ngrok-n8n.service
```

Старый `ngrok-n8n.service.d/override.conf` может добавлять ещё один
`ExecStartPost`. Если он дублирует команду, удалите только эту дублирующую
строку через редактор, сохранив нужные настройки. Итоговый сервис должен
выполнять updater-скрипт один раз.

```bash
systemctl --user daemon-reload
systemctl --user enable --now ngrok-n8n.service
systemctl --user status ngrok-n8n.service --no-pager -l
journalctl --user -u ngrok-n8n.service -b -n 80 --no-pager -l
```

Если сервис уже был запущен до изменения файлов:

```bash
systemctl --user restart ngrok-n8n.service
```

Ошибка GitHub в скрипте лишь записывается в журнал, чтобы не перезапускать
работающий ngrok из-за сбоя публикации. После устранения причины updater
нужно запустить повторно вручную с загруженным токеном.

## 13. Проверка всей цепочки и тест reboot

Сначала проверьте сайт без перезагрузки. Затем выполните `sudo reboot`,
войдите в GNOME как `allxx` и подождите запуска сервисов. При быстром интернете
обычно достаточно минуты, но GitHub Pages может публиковаться дольше.
Ничего не запускайте вручную во время проверки автозапуска.

```bash
pgrep -af 'nekobox|nekoray'
curl -4 --max-time 10 https://ipinfo.io/ip
loginctl show-user allxx -p Linger
systemctl --user is-active ngrok-n8n.service
curl -fsS http://127.0.0.1:4040/api/tunnels | python3 -m json.tool
```

```bash
cd ~/n8n
docker compose ps
grep -E 'WEBHOOK_URL|N8N_EDITOR_BASE_URL' docker-compose.yml
docker compose exec n8n env | grep -E 'WEBHOOK_URL|N8N_EDITOR_BASE_URL'
```

```bash
journalctl --user -u ngrok-n8n.service -b -n 80 --no-pager -l
curl --fail --location "https://provagon.ru/api/endpoint.json?t=$(date +%s)"
```

Условия успеха:

1. NekoBox и TUN работают, ngrok-сервис `active`.
2. ngrok URL совпадает с двумя URL внутри контейнера n8n.
3. В журнале есть успешный результат updater; в Actions завершился деплой.
4. JSON сайта содержит тот же базовый адрес плюс `/webhook/chat_vagon`.
5. Сообщение в браузерном чате получает ответ AI.

Для предварительной проверки CORS подставьте настоящий URL:

```bash
curl -i -X OPTIONS "https://ВАШ_АДРЕС.ngrok-free.app/webhook/chat_vagon" \
  -H 'Origin: https://provagon.ru' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type,ngrok-skip-browser-warning' \
  -H 'ngrok-skip-browser-warning: 1'
```

Проверочный запрос реально запускает workflow и может расходовать API-кредиты:

```bash
curl -i "https://ВАШ_АДРЕС.ngrok-free.app/webhook/chat_vagon" \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://provagon.ru' \
  -H 'ngrok-skip-browser-warning: 1' \
  --data '{"query":"Проверка подключения","chat_history":[]}'
```

Окончательная проверка — сообщение в браузере и отсутствие ошибок CORS
в Developer Tools → Console/Network.

## 14. Типовые ошибки

| Симптом | Что делать |
| --- | --- |
| `Author identity unknown` | Задать `git config user.name` и `user.email` в репозитории, повторить commit |
| `Invalid username or token` | Проверить PAT, срок, owner, доступ; повторить push с `-c credential.helper=` |
| `Everything up-to-date`, файл не найден в GitHub | Проверить `git status`, `git show HEAD:static/api/endpoint.json`; создать недостающий коммит |
| Updater: GitHub HTTP 404 | Проверить файл и ветку в GitHub; для закрытого репозитория также права PAT |
| Updater: HTTP 403 | Проверить Contents write, срок токена, правила ветки и ограничения API |
| `can't open file ...update-vagonai-webhook.py` | Скопировать `scripts/update_webhook.py` в `~/.local/bin` |
| `Set WEBHOOK_GITHUB_TOKEN on the server` | Загрузить env вручную или добавить EnvironmentFile в сервис |
| `Expected exactly one HTTPS tunnel` | Проверить локальный API, порт 5678; передать `--url` явно |
| `Permission denied` при Docker | Проверить группу docker, выйти и войти в GNOME; проверить `docker info` без sudo |
| ngrok не получает URL | Проверить VPN/TUN, ngrok-authtoken, сеть и `journalctl`; не менять адрес сайта вручную наугад |
| Pages JSON остаётся старым | Проверить последний Actions deploy, CDN и правильный домен |
| JSON новый, чат не отвечает | Проверить активность workflow, путь webhook, n8n logs, CORS и ответ JSON |
| ngrok показывает HTML вместо JSON | Проверить `ngrok-skip-browser-warning`, корректный endpoint и CORS для заголовка |
| Сервис запускает updater дважды | Проверить основной unit и `service.d/override.conf` |
| Запуск systemd прерывается по таймауту | Проверить эффективный TimeoutStartSec и ошибки ожидания/Compose |

После ручного исправления GitHub-токена:

```bash
set -a
. ~/.config/vagonai-webhook.env
set +a
python3 ~/.local/bin/update-vagonai-webhook.py
```

После редактирования unit/env-файла перезапустите сервис для получения нового
окружения. При изменении unit дополнительно нужен `daemon-reload`.

## 15. Резервные копии и восстановление данных n8n

Экспортируйте рабочий workflow из интерфейса n8n и храните его отдельно.
Экспорт workflow не заменяет резервную копию credentials и encryption key.
Сохраните `.env`, `docker-compose.yml`, профиль NekoBox, ngrok-конфигурацию,
скрипты и systemd-файлы в защищённом месте. GitHub/ngrok токены после потери
лучше перевыпустить; старые секреты не публикуйте в репозитории.

### Согласованная копия Docker volume

Пример ниже для volume `n8n_data` из Compose в разделе 9. На старой установке
сначала выясните его фактическое имя:

```bash
docker inspect n8n --format '{{range .Mounts}}{{println .Name .Source "->" .Destination}}{{end}}'
```

Остановите ngrok-сервис, чтобы его ExecStartPost не пересоздал n8n во время
копирования. Копирование требует временного простоя.

```bash
systemctl --user stop ngrok-n8n.service
cd ~/n8n
docker compose stop n8n
mkdir -p ~/backups/vagonai
chmod 700 ~/backups/vagonai
docker run --rm -v n8n_data:/data:ro -v "$HOME/backups/vagonai:/backup" \
  alpine sh -c 'tar czf /backup/n8n-data.tar.gz -C /data .'
cp ~/n8n/docker-compose.yml ~/backups/vagonai/
cp ~/n8n/.env ~/backups/vagonai/n8n.env
chmod 600 ~/backups/vagonai/*
docker compose start n8n
systemctl --user start ngrok-n8n.service
```

Для другого volume замените `n8n_data`. Перенесите архив и env на отдельный
носитель/защищённое хранилище; перезапись единственного архива не заменяет
историю резервных копий.

### Восстановление на чистой машине

Установите Docker, верните Compose и прежний `.env` в `~/n8n`. Убедитесь,
что используется прежняя версия n8n и тот же encryption key. До первого
запуска создайте пустой volume и восстановите архив:

```bash
docker volume create n8n_data
docker run --rm -v n8n_data:/data -v "$HOME/backups/vagonai:/backup:ro" \
  alpine sh -c 'tar xzf /backup/n8n-data.tar.gz -C /data'
cd ~/n8n
docker compose up -d
```

Эти команды предназначены для **пустого** volume. Не распаковывайте архив
поверх работающей базы. Не выполняйте `docker compose down -v` на установке,
данные которой нужно сохранить: флаг `-v` удаляет volumes.

## 16. Повседневная работа с сайтом

Updater создаёт коммиты удалённо, поэтому локальная ветка может отстать.
Перед новой правкой при чистом рабочем дереве:

```bash
cd ~/Документы/PY/SITES/PROVAGON/vagonai
git status
git pull --ff-only origin main
```

Если есть незакоммиченные изменения, сначала сохраните их коммитом или stash.
Если ветки разошлись, разберите изменения; не делайте force push, который
может затереть актуальный webhook.

### Локальный Hugo

Установите Hugo Extended из официальных releases для своей архитектуры.
[Релизы Hugo](https://github.com/gohugoio/hugo/releases).
Проверьте совместимость версии с проектом: текущий Pages workflow задаёт
`HUGO_VERSION: 0.128.0`, а локальная конфигурация также должна успешно
собираться выбранной версией. Если build падает на конфигурации pagination,
сверьте поддерживаемый синтаксис с выбранной версией и обновите версию/настройку
согласованно. Сборка Pages подтверждается успешным Actions, не наличием public.

```bash
hugo version
hugo server --bind 127.0.0.1 --port 3000 --disableFastRender
```

Откройте `http://127.0.0.1:3000`. Для обычной сборки: `hugo --minify`.
Редактируйте исходники в `provagon`, `layouts`, `static`, `content`;
`public` — результат сборки и будет заново сформирован Actions.

### SEO и публикация статей

Существующие инструменты проекта сохранены:

```bash
cp .env.example .env
python3 scripts/seo_blog.py plan
python3 scripts/seo_blog.py generate --batch 1
python3 scripts/seo_blog.py generate --batch 1 --overwrite
```

В `.env` задайте `OPENAI_API_KEY`, при необходимости `OPENAI_BASE_URL`.
Перед добавлением файлов в git убедитесь, что секретный `.env` не включён
в коммит. Зависимости SEO-скриптов устанавливайте согласно их импортам;
обычному webhook updater эти пакеты не нужны.

```bash
python3 scripts/deploy.py --message "Deploy new blog cluster"
python3 scripts/publish_cluster.py --batch 1 --dry-run
python3 scripts/publish_cluster.py --batch 1
```

Deploy-скрипт собирает Hugo и добавляет изменения в git: сначала проверьте
рабочее дерево и исключение секретов. Это отдельная автоматизация статей,
она не нужна для смены webhook.

## 17. Ограничения текущей схемы

- VPN требует входа в графическую сессию; это не серверный запуск без login.
- Автоматическое обновление вызывается при запуске ngrok-сервиса. Изменение
  URL внутри работающего агента без перезапуска не отслеживается постоянно.
- Сбой GitHub требует повторного запуска updater; фонового таймера повторов нет.
- GitHub Pages/CDN публикуют JSON с задержкой. PAT требует продления при истечении.
- Скрипт в разделе 11 рассчитан на `ngrok-free.app` и один нужный туннель.
- Содержимое AI workflow, VPN-профиля и credentials нужно резервировать отдельно.

## 18. Официальные справочники

- [Docker Engine на Ubuntu](https://docs.docker.com/engine/install/ubuntu/).
- [Установка ngrok](https://ngrok.com/download/linux).
- [Исходный проект Nekoray/NekoBox](https://github.com/MatsuriDayo/nekoray).
- [n8n: установка Docker](https://docs.n8n.io/deploy/host-n8n/install-options/install-with-docker.md).
- [n8n: Webhook node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/).
- [GitHub: API изменения файлов](https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents).
- [GitHub Pages: custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Установленная база памяти и RAG

6 октября 2026 установлена отдельная PostgreSQL с pgvector в Docker Desktop.
Настройки подключения, session_id, Postgres Chat Memory и резервные копии:
[docs/postgres-memory.md](docs/postgres-memory.md).

### История посетителя из PostgreSQL

С 7 октября 2026 сайт загружает последние 10 сообщений по кнопке с часами,
сохраняет имя, телефон, email и компанию между диалогами и приветствует
вернувшегося посетителя по имени. Восстановление без регистрации работает
в том же браузере. Установка, проверка и восстановление сервиса:
[docs/visitor-history.md](docs/visitor-history.md).

### Коммерческие предложения по почте

Подготовлена отправка HTML-КП Провагон с `info@provagon.ru` клиенту
и копией на `provagon@outlook.com`. Подключение SMTP Beget, включение отправки,
условия формирования КП и проверка: [docs/commercial-offer-email.md](docs/commercial-offer-email.md).
