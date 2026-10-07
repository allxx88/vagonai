# Отправка коммерческого предложения Провагон

Подготовлено 7 октября 2026 в workflow `8fbv0vLrGbslOMwX`.

- Отправитель: `provagon@outlook.com`.
- Получатель: email из профиля клиента в PostgreSQL.
- Копия (CC): `provagon@outlook.com`.
- Тема: «Провагон — коммерческое предложение».
- Формат: HTML-письмо с выбранными моделями, количеством и ценами сайта.
- Фактическая отправка пока отключена: аккаунт Outlook ещё не подключён.

## Когда формируется письмо

Клиент явно просит отправить КП на почту, например:
«Отправьте КП на почту на 2 полувагона модели 12-9046».
Если не хватает email, выбранной модели или количества, письмо не отправляется.
Модель извлекает только выбранные позиции; цены и HTML формирует Python
из `services/chat-history/catalog.json`. Неизвестная модель блокируется.
Формулировки «не отправляйте», вопросы о статусе и обычная консультация
не запускают отправку.

Одинаковое КП (посетитель, диалог, email, модели и количества) не отправляется
повторно после следующего ответа. Новый набор позиций формирует новое КП.
Повторная отправка после явной ошибки требует новой просьбы клиента.
Автоматические повторы почтовой ноды отключены: при потере ответа почтового
провайдера письмо могло уже уйти.

## Подключение Outlook.com

Microsoft требует OAuth2 / Modern Authentication:
https://support.microsoft.com/en-us/outlook/pop-imap-and-smtp-settings-for-outlook-com
Обычного пароля в SMTP-ноду может быть недостаточно. В workflow оставлена
исходная нода Send email, её From/To/CC/HTML исправлены, но она отключена.
Основной подготовленный путь использует **Send Offer via Outlook**.

1. Откройте Send Offer via Outlook → Credential → Create new credential.
2. Для собственного сервера n8n зарегистрируйте приложение Microsoft:
   https://aka.ms/appregistrations
3. Supported account types: личные Microsoft accounts и организационные
   аккаунты (multi-tenant + personal Microsoft accounts).
4. Платформа Redirect URI — Web. Скопируйте OAuth Redirect URL из n8n.
5. Скопируйте Application (client) ID в поле Client ID.
6. Certificates & secrets → New client secret. Его **Value**, а не ID,
   введите самостоятельно в Client Secret n8n.
7. Включите Custom Scopes и используйте `openid offline_access User.Read Mail.Send`.
   Эти разрешения нужны для входа, обновления токена и отправки почты.
   Доступ к календарям и контактам не требуется.
8. Connect my account → войдите именно как `provagon@outlook.com`
   и самостоятельно завершите разрешение доступа и сохранение credential.
9. Сообщите, что подключение сохранено. После этого можно активировать ноду
   Outlook и включить `MAIL_ENABLED: "true"` в Compose сервиса.

Инструкция n8n: https://docs.n8n.io/integrations/builtin/credentials/microsoft/

После смены ngrok адреса callback OAuth меняется. Перед повторным подключением
обновите Redirect URI приложения Microsoft адресом, который показывает n8n.
Работающий refresh token не следует удалять только из-за смены ngrok URL.

## Включение после авторизации

Перед включением проверьте выбранный credential и аккаунт отправителя.
Активируйте Send Offer via Outlook, сохраните и опубликуйте workflow.
Затем в `services/chat-history/compose.yml` установите `MAIL_ENABLED: "true"`:

```bash
docker --context desktop-linux compose \
  --env-file /home/allxx/n8n/postgres/.env \
  -f services/chat-history/compose.yml up -d --no-build
```

Не включайте флаг до активации и проверки почтовой ноды. До подключения
создаются только черновики, реальные письма не уходят.

## Проверка и восстановление

Результат хранится в таблице `commercial_offers` базы `chat_memory`:
`draft` — подготовлено без подключённой почты, `pending` — передано на отправку,
`sent` — Outlook API подтвердил приём, `failed` — ошибка почтовой ноды.
`sent` означает принятие провайдером, доставка в ящик адресата не гарантируется
этим статусом. Агент не должен объявлять отправку без подтверждённого статуса.

Проверка без отправки реальных писем:

```bash
docker --context desktop-linux exec -i -e PYTHONPATH=/app \
  vagonai-chat-history python - < services/chat-history/test_offers.py
```

Генератор узлов из экспорта workflow **до добавления почтовых узлов**:

```bash
python3 services/chat-history/prepare_mail_workflow.py backup-before-mail.json \
  --output /tmp/vagonai-mail-ready.json
```

Не запускайте генератор повторно поверх уже расширенного workflow.
При обновлении `static/catalog-data.js` обновите и `catalog.json`; текущий
снимок цен используется для защиты от выдуманных цен в письме.
Секреты Microsoft хранятся только в credentials n8n, не в репозитории.
