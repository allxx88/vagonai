# Автоматическое обновление webhook

Главная страница Hugo берётся из `provagon/index.html`. Перед каждым сообщением
чат читает `api/endpoint.json` без кеша. Начальный адрес:
`https://shumorusilu.beget.app/webhook/chat_vagon`.
При ошибке конфигурации сообщение не отправляется на старый адрес.

## 

Документация API: https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents
