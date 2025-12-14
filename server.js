// server.js
import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current module's directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
import dotenv from 'dotenv';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Load .env file
dotenv.config({ path: '.env' });

// Log environment variables for debugging
console.log('Environment variables loaded:');
console.log('- FIREBASE_DATABASE_URL:', process.env.FIREBASE_DATABASE_URL);
console.log('- GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
console.log('- FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID);
console.log('- PORT:', process.env.PORT);

// Initialize Firebase Admin
console.log('Initializing Firebase Admin...');

try {
  let credential;
  
  // Check if we're in production (Render) or development
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    // Production: Use environment variables
    console.log('Using Firebase credentials from environment variables');
    credential = admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL
    });
  } else {
    // Development: Use service account key file
    console.log('Using Firebase service account key file');
    const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));
    console.log('Service account key loaded successfully');
    credential = admin.credential.cert(serviceAccount);
  }
  
  admin.initializeApp({
    credential: credential,
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
  
  console.log('Firebase Admin initialized successfully');
} catch (error) {
  console.error('Error initializing Firebase Admin:', error.message);
  throw error;
}

const db = admin.firestore();

const app = express();

// Middleware
app.use(cors({
  origin: true, // Allow all origins in development
  credentials: true, // Allow credentials
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Log all requests for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

app.use(bodyParser.json());

// Helper function to convert Firestore timestamps to serializable format
const serializeTimestamp = (timestamp) => {
  if (!timestamp) return null;
  
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toISOString();
  }
  
  if (timestamp.seconds !== undefined) {
    return new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000).toISOString();
  }
  
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }
  
  return timestamp;
};

// Helper function to serialize Firestore document data
const serializeDocumentData = (data) => {
  const serialized = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && (value.toDate || value.seconds !== undefined)) {
      serialized[key] = serializeTimestamp(value);
    } else {
      serialized[key] = value;
    }
  }
  
  return serialized;
};

// API Routes

// GET /api/health - Перевірка здоров'я сервісу
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

// GET /api/equipment - Отримати всі обладнання
app.get('/api/equipment', async (req, res) => {
  try {
    console.log('Fetching equipment from Firestore...');
    
    // Отримуємо дані з Firestore
    const snapshot = await db.collection('equipment').get();
    
    if (snapshot.empty) {
      console.log('No equipment found in Firestore');
      return res.status(200).json([]);
    }
    
    const equipmentList = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      equipmentList.push({
        id: doc.id,
        name: data.name || 'Без назви',
        price: Number(data.price) || 0,
        stock: Number(data.stock) || 0,
        category: data.category || 'other',
        image: data.image || '/images/placeholder.png',
        detail: data.detail || 'Опис відсутній'
      });
    });
    
    console.log(`Successfully fetched ${equipmentList.length} equipment items from Firestore`);
    return res.status(200).json(equipmentList);
  } catch (error) {
    console.error('Error fetching equipment from Firestore:', error);
    return res.status(500).json({ error: 'Помилка отримання даних про обладнання' });
  }
});

// GET /api/rentals - Отримати всі оренди (з авторизацією)
app.get('/api/rentals', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Необхідна авторизація' });
    }

    const token = authHeader.split(' ')[1];
    let decodedToken;

    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (error) {
      console.error('Помилка перевірки токена:', error);
      return res.status(401).json({ error: 'Недійсний токен' });
    }

    const userId = decodedToken.uid;

    // Отримати оренди для конкретного користувача
    let query = db.collection('rentals').where('userId', '==', userId);

    // Фільтрація по ціні, якщо вказано
    const { minPrice, maxPrice } = req.query;
    if (minPrice !== undefined || maxPrice !== undefined) {
      if (minPrice !== undefined && maxPrice !== undefined) {
        query = query.where('price', '>=', Number(minPrice)).where('price', '<=', Number(maxPrice));
      } else if (minPrice !== undefined) {
        query = query.where('price', '>=', Number(minPrice));
      } else if (maxPrice !== undefined) {
        query = query.where('price', '<=', Number(maxPrice));
      }
    }

    const snapshot = await query.get();

    const rentals = [];
    snapshot.forEach(doc => {
      const data = serializeDocumentData(doc.data());
      rentals.push({
        id: doc.id,
        ...data
      });
    });

    // Додати зображення з обладнання для кожного rental
    const rentalsWithImages = await Promise.all(rentals.map(async (rental) => {
      try {
        const equipmentDoc = await db.collection('equipment').doc(rental.equipmentId).get();
        if (equipmentDoc.exists) {
          const equipmentData = equipmentDoc.data();
          return {
            ...rental,
            image: equipmentData.image || '',
            category: equipmentData.category || 'other'
          };
        }
      } catch (error) {
        console.warn(`Could not fetch equipment for rental ${rental.id}:`, error);
      }
      return {
        ...rental,
        image: '',
        category: 'other'
      };
    }));

    console.log(`Returning ${rentalsWithImages.length} rentals for user ${userId}`);
    res.json({ data: rentalsWithImages });
  } catch (error) {
    console.error('Помилка отримання оренд:', error);
    res.status(500).json({
      error: 'Не вдалося отримати оренди',
      details: error.message
    });
  }
});

// POST /api/rentals - Створити нову оренду
app.post('/api/rentals', async (req, res) => {
  try {
    const { equipmentId, startDate, endDate, quantity, name, price } = req.body;
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Необхідна авторизація' });
    }
    
    const token = authHeader.split(' ')[1];
    let decodedToken;
    
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (error) {
      console.error('Помилка перевірки токена:', error);
      return res.status(401).json({ error: 'Недійсний токен' });
    }
    
    const userId = decodedToken.uid;
    
    // Перевірка наявності всіх необхідних даних
    if (!equipmentId || !startDate || !endDate || !quantity || !name || price === undefined) {
      return res.status(400).json({ 
        error: 'Відсутні обов\'язкові поля',
        required: ['equipmentId', 'startDate', 'endDate', 'quantity', 'name', 'price']
      });
    }
    
    // Перевірка дат
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (start < today) {
      return res.status(400).json({ error: 'Дата початку не може бути в минулому' });
    }
    
    if (end <= start) {
      return res.status(400).json({ error: 'Дата закінчення повинна бути після дати початку' });
    }
    
    // Перевірка кількості
    if (quantity <= 0) {
      return res.status(400).json({ error: 'Кількість повинна бути більше 0' });
    }
    
    // Перевірка наявності обладнання
    const equipmentRef = db.collection('equipment').doc(equipmentId);
    const equipmentDoc = await equipmentRef.get();
    
    if (!equipmentDoc.exists) {
      return res.status(404).json({ error: 'Обладнання не знайдено' });
    }
    
    const equipmentData = equipmentDoc.data();
    
    // Перевірка наявної кількості
    if (equipmentData.stock < quantity) {
      return res.status(400).json({ 
        error: 'Недостатня кількість на складі',
        available: equipmentData.stock,
        requested: quantity
      });
    }
    
    // Оновлення кількості на складі
    await equipmentRef.update({
      stock: admin.firestore.FieldValue.increment(-quantity)
    });
    
    // Створення оренди
    const rentalData = {
      userId,
      equipmentId,
      name: String(name), // Ensure it's a string
      price: Number(price * quantity), // Ensure it's a number
      quantity: Number(quantity), // Ensure it's a number
      startDate: admin.firestore.Timestamp.fromDate(new Date(startDate)),
      endDate: admin.firestore.Timestamp.fromDate(new Date(endDate)),
      status: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const rentalRef = await db.collection('rentals').add(rentalData);
    
    // Return serialized data
    const responseData = {
      id: rentalRef.id,
      userId,
      equipmentId,
      name: String(name),
      price: Number(price * quantity),
      quantity: Number(quantity),
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    res.status(201).json(responseData);
    
  } catch (error) {
    console.error('Помилка при створенні оренди:', error);
    res.status(500).json({ 
      error: 'Не вдалося створити оренду',
      details: error.message 
    });
  }
});

// DELETE /api/rentals/:id - Видалити оренду
app.delete('/api/rentals/:id', async (req, res) => {
  try {
    const rentalId = req.params.id;
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Необхідна авторизація' });
    }
    
    const token = authHeader.split(' ')[1];
    let decodedToken;
    
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (error) {
      console.error('Помилка перевірки токена:', error);
      return res.status(401).json({ error: 'Недійсний токен' });
    }
    
    const userId = decodedToken.uid;
    
    // Перевірити, чи належить оренда користувачу
    const rentalRef = db.collection('rentals').doc(rentalId);
    const rentalDoc = await rentalRef.get();
    
    if (!rentalDoc.exists) {
      return res.status(404).json({ error: 'Оренду не знайдено' });
    }
    
    const rentalData = rentalDoc.data();
    
    if (rentalData.userId !== userId) {
      return res.status(403).json({ error: 'Немає прав для видалення цієї оренди' });
    }
    
    // Повернути кількість на склад
    if (rentalData.equipmentId && rentalData.quantity) {
      const equipmentRef = db.collection('equipment').doc(rentalData.equipmentId);
      await equipmentRef.update({
        stock: admin.firestore.FieldValue.increment(rentalData.quantity)
      });
    }
    
    // Видалити оренду
    await rentalRef.delete();
    
    res.status(200).json({ message: 'Оренду видалено' });
  } catch (error) {
    console.error('Помилка при видаленні оренди:', error);
    res.status(500).json({ 
      error: 'Не вдалося видалити оренду',
      details: error.message 
    });
  }
});

// Legacy routes for backward compatibility (removed duplicates)

// GET /rentals - Redirect to API route
app.get('/rentals', (req, res) => {
  res.redirect('/api/rentals');
});

// POST /rentals - Redirect to API route
app.post('/rentals', (req, res) => {
  res.redirect(307, '/api/rentals'); // 307 preserves the POST method
});

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, 'dist'), {
  setHeaders: (res, filePath) => {
    // Set proper MIME type for JavaScript files
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// Handle SPA routing - serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Щось пішло не так!' });
});

// Start the server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Сервер запущено на порту ${PORT}`);
  console.log(`Доступно за посиланням: http://localhost:${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Необроблена помилка промісу:', err);
  server.close(() => process.exit(1));
});