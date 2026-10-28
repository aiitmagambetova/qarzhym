# QARZHYM — Жеке қаржы көмекшісі

Дипломдық жоба: **«Жеке қаржыны есепке алуға арналған бағдарламалық қамтамасыз етуді әзірлеу»**.

## Мақсаты
Пайдаланушыға кіріс-шығысын, бюджетін, жинақ мақсаттарын және қаржылық жоспарын бір жерде жүргізуге көмектесу. Интерфейс — қазақ тілінде, валюта — теңге (₸).

## Негізгі мүмкіндіктер
Тіркелу/кіру (bcrypt, Firestore сессиясы) · транзакциялар (CRUD, іздеу, сүзгі, сұрыптау) · бюджеттер · күнтізбе (ай/апта) · есептер мен 4 диаграмма (Chart.js), CSV, басып шығару · жинақ мақсаттары · қаржылық жоспар · санаттар · қолданба ішіндегі хабарландырулар · профиль/баптаулар · ашық/қараңғы тақырып.

## Технологиялар
HTML/CSS/Vanilla JS, Chart.js · Node.js, Express, **Firebase Firestore (firebase-admin)**, express-session (Firestore сақтағышы), bcrypt, express-validator, helmet, express-rate-limit · Docker Compose (міндетті емес).
Frontend Express арқылы беріледі (Nginx жоқ). Дерекқор — бұлттағы Firebase Firestore, сондықтан жергілікті MySQL қажет емес.

## Құрылым
```
backend/   server.js, app.js, config/firebase.js, middleware/, routes/, lib/ (store.js — Firestore қабаты, stats.js — есептеулер), scripts/seed.js, tests/
frontend/  *.html, css/, js/
firestore.rules, FIREBASE_SETUP.md, Dockerfile, docker-compose.yml, .env.example
```

## Қажетті бағдарламалар
Node.js 18+ және Firebase жобасы (тегін Spark жоспары жеткілікті). Docker — міндетті емес.

## Firebase-ті қосу (қысқаша)
1. Firebase Console → жоба жасау → **Firestore Database → Create database**.
2. **Project settings → Service accounts → Generate new private key** → JSON жүктеу.
3. Файлды жоба түбіне `serviceAccountKey.json` деп қойыңыз (git-ке салынбайды).
4. Іске қосу:
```bash
cd backend && npm install && npm start     # http://localhost:3000
```
Docker арқылы: `docker compose up -d --build`. Толық нұсқаулық: **FIREBASE_SETUP.md**.
`.env` ішінде `SESSION_SECRET` көрсетілген; HTTPS жоқ жергілікті сынақта `COOKIE_SECURE=false`.

## Демо деректер (міндетті емес)
Алдымен тіркеліңіз, сосын: `cd backend && npm run seed`. Демо жазбалар «[ДЕМО]» деп белгіленеді және бірінші пайдаланушыға қосылады.

## Қолдану
Транзакциялар бетінде «Транзакция қосу»; Бюджет бетінде санат пен мерзім бойынша лимит; Жинақтар бетінде мақсат құрып, «Салу/Алу» батырмаларымен ақша қосу. Санаттар әдепкі түрде тіркелгенде бір рет жасалады.

## Қаржылық формулалар
- Баланс = бастапқы баланс (Баптаулар, әдепкі 0) + барлық кіріс − барлық шығыс
- Таза айырма = кіріс − шығыс; орташа күндік шығын = шығыс / кезеңдегі күн саны
- Санат үлесі = санат шығыны / жалпы шығыс × 100; бюджет пайдаланылуы = (санат пен мерзімге сәйкес шығыс) / бюджет сомасы × 100; қалдық = бюджет − шығыс
- Бюджет күйі: ≥80% — «лимитке жақын», >100% — «асып кетті»
- Жинақ қалдығы = мақсат − жиналған; прогресс = жиналған / мақсат × 100
- Нөлге бөлу 0 деп қайтарылады (NaN/Infinity шықпайды)
- **Жинақ жарналары шығыс емес**: баланс пен шығыс есептеріне кірмейді, «Жинақ сомасы» бөлек көрсетіледі.
- **Жоспарланған төлемдер нақты емес**: күнтізбеде/жоспарда бөлек көрінеді; «Орындалды» деп белгілеу транзакция жасамайды — нақты шығынды Транзакциялар бетінде енгізесіз.
- Айлық жарна болжамы = қалған сома / қалған ай саны. Толық емес ай толық ай болып саналады; мерзімі өтсе — қалған соманың бәрі «қазір» қажет деп көрсетіледі; мақсатқа жетсе — 0. Болжам нәтижені кепілдемейді.

## API шолуы
`/api/auth/*`, `/api/transactions`, `/api/budgets`, `/api/categories`, `/api/calendar`, `/api/reports/{summary,income-expenses,categories,monthly,budgets}`, `/api/savings(+/:id/contributions)`, `/api/planner/{goals,transactions,overview}`, `/api/dashboard`, `/api/profile`, `/api/settings`, `/api/notifications`, `/api/health`.
Жауап: `{success, data}` немесе `{success:false, message}`. Барлық өзгертуші сұраныстарға `X-CSRF-Token` тақырыбы қажет (`GET /api/auth/csrf`).

## Қауіпсіздік
bcrypt (12), HTTP-only cookie, сессия Firestore-да, кіруде сессия қайта жасалады, CSRF токені, helmet, rate limit (кіру/тіркелу), express-validator, Firestore ережелері толық жабық (тек сервер Admin SDK арқылы кіреді), user_id тек сессиядан алынады, санаттың иесі тексеріледі, CSV формула инъекциясынан қорғау.

## Тесттер
Сервер іске қосулы болғанда: `cd backend && BASE_URL=http://localhost:3000 npm test` (тесттер **ақиқат дерекқорға** тестілік пайдаланушылар қосады).

## Қателерді шешу
- «Firebase кілті табылмады» — `serviceAccountKey.json` жоба түбінде емес. «Firestore дерекқоры жасалмаған» — Console-да **Create database** басыңыз.
- Кіргеннен кейін қайта `login`-ге түссе: HTTPS жоқта `COOKIE_SECURE=false` қойыңыз.
- Диаграммалар шықпаса: Chart.js CDN-ге (cdn.jsdelivr.net) интернет қажет.
- Docker: `docker compose logs -f app`.

## Серверге орналастыру (VPS)
Өз VPS/домен/DNS есебіңіз қажет. `serviceAccountKey.json` файлын серверге қолмен көшіріңіз (git арқылы емес!). Қолданба әлі еш жерге орналастырылмаған.
```bash
curl -fsSL https://get.docker.com | sh && sudo usermod -aG docker $USER   # қайта кіріңіз
git clone <сіздің-репозиторий> qarzhym && cd qarzhym
cp .env.example .env && nano .env     # күшті құпиясөздер, COOKIE_SECURE=true
docker compose up -d --build
```
**Домен және HTTPS:** домен A-жазбасын VPS IP-ге бағыттаңыз; Caddy қолдану ең оңай — `/etc/caddy/Caddyfile`:
```
qarzhym.example.kz {
    reverse_proxy 127.0.0.1:3000
}
```
`sudo apt install caddy` — сертификат автоматты алынады. Сосын `.env`-те `COOKIE_SECURE=true` және `docker compose up -d`. Файрволда тек 80/443/22 ашыңыз, `APP_PORT` қолданбасын `127.0.0.1:3000:3000` ету ұсынылады.

**Бэкап:** Firebase Console → Firestore → Import/Export (Cloud Storage бакеті керек) немесе `gcloud firestore export gs://<бакет>`.

**Жаңарту/қайта іске қосу** (деректер Firestore-да, жоғалмайды):
```bash
git pull && docker compose up -d --build
docker compose restart app
docker compose logs -f --tail=100 app
```

## Дизайн

Фронтенд қараңғы жасыл (neon green) стильге ауыстырылды: сызықты SVG белгішелер, іздеу жолы, пайдаланушы мәзірі (профиль / баптаулар / тақырып / шығу), спарклайн-карталар, Апта/Ай/Жыл диаграммасы (`GET /api/dashboard?range=week|month|year`), санаттар донаты, соңғы операциялар кестесі және жинақ мақсаты блогы. Әдепкі тақырып — қараңғы; ашық тақырып та сақталған.
