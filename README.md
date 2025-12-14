# Sport Rent App

Веб-додаток для оренди спортивного обладнання з використанням React, Firebase та Express.js.

## Функціональність

- Аутентифікація користувачів (реєстрація/вхід)
- Перегляд та фільтрація спортивного обладнання
- Оренда обладнання з вибором дати та часу
- Інтеграція платіжної системи
- Управління особистими орендами
- Адаптивний дизайн

## Технології

- **Frontend**: React 18.3.1, Vite, TailwindCSS
- **Backend**: Express.js, Firebase Admin SDK
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **Deployment**: Render.com / Docker

## Локальний запуск

1. Клонуйте репозиторій:
```bash
git clone <repository-url>
cd sport-rent-app
```

2. Встановіть залежності:
```bash
npm install
```

3. Налаштуйте Firebase:
   - Створіть проект у Firebase Console
   - Додайте веб-додаток до проекту
   - Завантажте serviceAccountKey.json
   - Оновіть конфігурацію у `firebase.js` та `server.js`

4. Запустіть додаток:
```bash
npm run dev
```

Сервер буде доступний на `http://localhost:5173`

## Деплой на Render.com

1. Створіть репозиторій на GitHub та завантажте код

2. Зареєструйтесь на [Render.com](https://render.com)

3. Створіть новий Web Service:
   - Підключіть GitHub репозиторій
   - Виберіть Node.js runtime
   - Build Command: `npm install && npm run build`
   - Start Command: `node server.js`

4. Налаштуйте Environment Variables:
   - `NODE_ENV`: `production`
   - `PORT`: `10000`
   - `FIREBASE_PROJECT_ID`: ваш project ID
   - `FIREBASE_PRIVATE_KEY`: приватний ключ (з serviceAccountKey.json)
   - `FIREBASE_CLIENT_EMAIL`: email сервісного акаунту
   - `FIREBASE_DATABASE_URL`: https://ваш-project-id-default-rtdb.firebaseio.com/

5. Деплой буде виконано автоматично

## Структура проекту

```
sport-rent-app/
├── public/                 # Статичні файли
├── src/
│   ├── api/               # API функції
│   ├── components/        # React компоненти
│   ├── pages/            # Сторінки додатку
│   ├── App.jsx           # Головний компонент
│   ├── main.jsx          # Точка входу
│   └── firebase.js       # Firebase конфігурація
├── server.js              # Express сервер
├── Dockerfile             # Docker конфігурація
├── render.yaml            # Render.com конфігурація
└── package.json           # Залежності та скрипти
```

## API Endpoints

- `GET /api/health` - Перевірка здоров'я сервісу
- `GET /api/equipment` - Отримати всі обладнання
- `POST /api/equipment` - Додати нове обладнання
- `GET /api/rentals` - Отримати оренди користувача
- `POST /api/rentals` - Створити нову оренду
- `DELETE /api/rentals/:id` - Скасувати оренду

## Ліцензія

MIT License