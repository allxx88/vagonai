# PostgreSQL: память n8n и подготовка RAG

Установка 6 октября 2026: Docker Desktop, контейнер `vagonai-postgres`, образ
`pgvector/pgvector:0.8.6-pg17-trixie`, постоянный volume
`vagonai_postgres_data`. Compose и секреты: `/home/allxx/n8n/postgres`.
Подключён к существующей сети `n8n_n8n-network`. Внешние порты не опубликованы.
Контейнер доступен n8n как `vagonai-postgres:5432`.

## 1. Credential в n8n

Credentials → New → Postgres:

| Поле | Значение |
|---|---|
| Host | `vagonai-postgres` |
| Port | `5432` |
| Database | `chat_memory` |
| User | `vagonai` |
| Password | Значение `APP_PASSWORD` из локального `.env` |
| SSL | Disable для текущей внутренней Docker-сети |
| SSH Tunnel | Off |

Посмотреть пароль только на своём экране:

```bash
nano /home/allxx/n8n/postgres/.env
```

Не используйте `POSTGRES_PASSWORD`: это пароль администратора. Не публикуйте
содержимое файла. Сохранение нового credential в интерфейсе пользователь
выполняет самостоятельно. Нажмите Test connection, затем сохраните.

## 2. Передача идентификатора диалога

Исходники сайта подготовлены: в JSON запроса добавлен `session_id`.
Он состоит из случайного ID браузера и ID диалога, сохраняется между
перезагрузками страницы в localStorage и различается между браузерами.
Изменение отправлено в GitHub 7 октября 2026, коммит
`4d830631a50f02b7a47d8b61af46be9f49f24d8f`. Дождитесь успешного Pages
и обновите страницу, чтобы браузер загрузил новый JavaScript.

В узле Validate Input замените код:

```javascript
const body = $json.body || {};
const query = body.query || body.message;
const sessionId = body.session_id;

if (typeof query !== "string" || !query.trim()) {
  throw new Error("Не передан текст запроса");
}
if (typeof sessionId !== "string" || !sessionId.trim() || sessionId.length > 200) {
  throw new Error("Не передан корректный session_id");
}

return {
  prompt: query.trim(),
  session_id: sessionId,
  chat_history: Array.isArray(body.chat_history) ? body.chat_history : []
};
```

Не используйте общий ключ `default` для всех посетителей: это смешает диалоги.
`session_id` разделяет память, но не является полноценной авторизацией.
Не добавляйте публичный endpoint чтения переписки без проверки владельца.

## 3. Postgres Chat Memory

В редакторе нажмите `+` у входа **Memory** узла AI Agent и добавьте
**Postgres Chat Memory**. Настройте:

- Credential: Postgres из раздела 1.
- Session ID / Session Key: Define below, expression
  `{{ 'provagon:' + $json.session_id }}`.
- Table Name: `provagon_chat_memory`.
- Context Window Length: `10` для начала.

AI Agent: Prompt (User Message) оставьте `{{ $json.prompt }}`.
Сохраните и Publish. Таблицу создаст memory node при первом использовании.
Не передавайте старый chat_history дополнительно в prompt, если историю уже
подставляет memory node: это может дублировать контекст.
Для другого сайта используйте другую таблицу или префикс ключа.

## 4. Проверка

В одном диалоге отправьте «Запомни: меня зовут Алексей», затем
«Как меня зовут?». Обновите страницу, откройте тот же диалог и повторите вопрос.
В новом диалоге имя не должно быть известно. Ответ модели — функциональная
проверка, а факт сохранения проверяется в таблице:

```bash
docker exec vagonai-postgres psql -U postgres -d chat_memory -c '\dt'
docker exec vagonai-postgres psql -U postgres -d chat_memory -c 'SELECT count(*) FROM provagon_chat_memory;'
```

До первого успешного вызова memory node таблица может отсутствовать.
База хранит сообщения независимо от ngrok URL. Очистка localStorage теряет
идентификатор доступа к старому диалогу, но не удаляет записи базы.
Восстановление полного списка сообщений в интерфейсе сайта — отдельная задача:
memory node не добавляет автоматически backend истории и авторизацию.

## 5. RAG

Подготовлена отдельная база `rag`, в ней включено расширение `vector`.
Создайте второй Postgres credential с теми же Host/User/Password и Database
`rag`. Для RAG используйте PGVector Vector Store node, отдельную таблицу,
embedding-модель и workflow загрузки документов. Размерность векторов зависит
от embedding-модели; её пока не выбирали, поэтому таблицы/индексы RAG не созданы,
документы не загружены. Postgres Chat Memory сам RAG не выполняет.

## 6. Управление и резервные копии

```bash
docker compose -f /home/allxx/n8n/postgres/compose.yml ps
docker logs --tail 50 vagonai-postgres
```

Volume переживает пересоздание контейнера. Не используйте `down -v` для удаления
этой установки, если данные нужно сохранить. `restart: unless-stopped`
применяется после запуска Docker Desktop; сам Desktop должен запускаться при login.

Резервная копия обеих баз, без публикации паролей:

```bash
mkdir -p ~/backups/vagonai
chmod 700 ~/backups/vagonai
(umask 077; docker exec vagonai-postgres pg_dump -U postgres -Fc chat_memory > ~/backups/vagonai/chat-memory.dump)
(umask 077; docker exec vagonai-postgres pg_dump -U postgres -Fc rag > ~/backups/vagonai/rag.dump)
```

Отдельно сохраните конфигурацию, `.env` и экспорт workflow в защищённом
хранилище. Копии нужно переносить за пределы этого диска.

## Проверенный workflow — 7 октября 2026

Workflow `8fbv0vLrGbslOMwX` опубликован с POST `/webhook/chat_vagon`.
Узел Postgres Chat Memory подключён к агенту продавца. Исправлен ключ
на `{{ 'provagon:' + $json.session_id }}`. Проверено сохранение сообщений
в `provagon_chat_memory`, восстановление имени и количества вагонов
при пустом `chat_history`, а также разделение двух сессий.
