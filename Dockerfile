# Використовуємо Node.js 18 LTS
FROM node:18-alpine

# Встановлюємо робочу директорію
WORKDIR /app

# Копіюємо package.json та package-lock.json
COPY package*.json ./

# Встановлюємо залежності
RUN npm ci --only=production

# Копіюємо решту файлів проекту
COPY . .

# Збираємо додаток
RUN npm run build

# Вказуємо порт, який буде використовувати додаток
EXPOSE 3000

# Команда для запуску додатку
CMD ["npm", "start"]