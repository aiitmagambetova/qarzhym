# Подключение Firebase — 5 минут

MySQL больше не нужен. Все данные лежат в **Firebase Firestore**. Фронтенд не менялся.

## 1. Создай проект и базу
1. https://console.firebase.google.com → **Add project** (Analytics можно выключить).
2. Слева **Build → Firestore Database → Create database**.
   Режим — **Production mode** (правила «всё закрыто» — это правильно, см. ниже), регион любой (например `eur3` или `europe-west`).

## 2. Скачай ключ
**⚙ Project settings → Service accounts → Generate new private key** → скачается JSON-файл.

## 3. Положи ключ в проект
Положи файл в корень проекта (рядом с `docker-compose.yml`) и назови **`serviceAccountKey.json`**.
(Файл с оригинальным именем `…firebase-adminsdk….json` тоже подхватится автоматически — в корне или в `backend/`.)

## 4. Запусти
```bash
cd backend
npm install
npm start
```
Открой http://localhost:3000 → «Тіркелу» → регистрируйся. Всё.

Через Docker: `docker compose up -d --build` (MySQL-контейнера больше нет, ключ подхватывается из `serviceAccountKey.json`).

Демо-данные (по желанию, после регистрации): `cd backend && npm run seed`

## Альтернатива без файла
В `.env` можно вместо файла задать три переменные из того же JSON:
```
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```
или одной строкой `FIREBASE_SERVICE_ACCOUNT_JSON` (JSON или base64).

## Безопасность — важно
- Ключ `serviceAccountKey.json` = полный доступ к твоей базе. **Не заливай в GitHub** (он уже в `.gitignore`), не отправляй никому. Если утёк — Service accounts → удалить ключ и создать новый.
- Браузер напрямую в Firestore не ходит — только через твой сервер. Поэтому правила базы закрыты полностью (`firestore.rules`, deny-all). Сервер (Admin SDK) правила обходит.

## Как хранятся данные
`users/{id}/transactions | categories | budgets | savings_goals | savings_contributions | financial_goals | planned_transactions | calendar_events | notifications`,
плюс `emails/{hash}` (уникальность почты) и `sessions/{sid}` (сессии). Индексы создавать не нужно.

## Если не стартует
| Ошибка | Причина |
|---|---|
| «Firebase кілті табылмады» | файл не лежит в корне / назван иначе |
| «Firestore дерекқоры жасалмаған» | не нажал **Create database** (шаг 1) |
| «Рұқсат жоқ / PERMISSION_DENIED» | ключ от другого проекта или Firestore API выключен |
| вечно кидает на login | без HTTPS в `.env` должно быть `COOKIE_SECURE=false` |
