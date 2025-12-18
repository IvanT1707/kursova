import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

dotenv.config({ path: '.env' });

// Ініціалізація Firebase Admin
console.log('Initializing Firebase Admin...');

try {
  let credential;
  
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    console.log('Using Firebase credentials from environment variables');
    credential = admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL
    });
  } else {
    console.log('Using Firebase service account key file');
    const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));
    credential = admin.credential.cert(serviceAccount);
  }
  
  admin.initializeApp({
    credential: credential,
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
  
  console.log('Firebase Admin initialized successfully');
} catch (error) {
  console.error('Error initializing Firebase Admin:', error.message);
  process.exit(1); // Вихід, якщо база не підключилася
}

const db = admin.firestore();
const app = express();

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(bodyParser.json());

// Логування тільки в розробці або мінімальне для деплою
app.use((req, res, next) => {
  if (req.originalUrl !== '/api/health') { // Не забиваємо логи хелс-чеками
    console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  }
  next();
});

// --- Допоміжні функції ---

const serializeTimestamp = (timestamp) => {
  if (!timestamp) return null;
  if (timestamp.toDate && typeof timestamp.toDate === 'function') return timestamp.toDate().toISOString();
  if (timestamp.seconds !== undefined) return new Date(timestamp.seconds * 1000).toISOString();
  return timestamp;
};

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

// Функція для автоматичного завершення оренд (оптимізована)
async function completeExpiredRentals() {
  try {
    console.log('Checking for expired rentals...');
    const todayStr = new Date().toISOString().split('T')[0];
    
    const expiredRentalsSnapshot = await db.collection('rentals')
      .where('status', '==', 'active')
      .where('endDate', '<=', todayStr)
      .get();
    
    if (expiredRentalsSnapshot.empty) {
      console.log('No expired rentals to process.');
      return;
    }

    const batch = db.batch();
    const equipmentUpdates = new Map();
    
    expiredRentalsSnapshot.forEach(doc => {
      const rental = doc.data();
      batch.update(doc.ref, { 
        status: 'completed',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      const currentQty = equipmentUpdates.get(rental.equipmentId) || 0;
      equipmentUpdates.set(rental.equipmentId, currentQty + (Number(rental.quantity) || 0));
    });
    
    await batch.commit();

    for (const [id, qty] of equipmentUpdates) {
      await db.collection('equipment').doc(id).update({
        stock: admin.firestore.FieldValue.increment(qty)
      });
    }
    
    console.log(`Successfully completed ${expiredRentalsSnapshot.size} rentals.`);
  } catch (error) {
    console.error('Error in completeExpiredRentals:', error);
  }
}

// --- API Routes ---

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'healthy', uptime: process.uptime() });
});

app.get('/api/equipment', async (req, res) => {
  try {
    const snapshot = await db.collection('equipment').get();
    const equipmentList = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    res.status(200).json(equipmentList);
  } catch (error) {
    res.status(500).json({ error: 'Firestore error' });
  }
});

app.get('/api/rentals', async (req, res) => {
  try {
    // ПРИБРАНО: completeExpiredRentals() - це гальмувало відповідь
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const userId = decodedToken.uid;

    const snapshot = await db.collection('rentals').where('userId', '==', userId).get();
    const rentals = snapshot.docs.map(doc => ({ id: doc.id, ...serializeDocumentData(doc.data()) }));

    res.json({ data: rentals });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/rentals', async (req, res) => {
  try {
    const { equipmentId, startDate, endDate, quantity, name, price } = req.body;
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    
    const token = authHeader.split(' ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    const equipmentRef = db.collection('equipment').doc(equipmentId);
    const equipmentDoc = await equipmentRef.get();
    
    if (!equipmentDoc.exists || equipmentDoc.data().stock < quantity) {
      return res.status(400).json({ error: 'Not enough stock' });
    }

    await equipmentRef.update({ stock: admin.firestore.FieldValue.increment(-quantity) });

    const rentalData = {
      userId: decodedToken.uid,
      equipmentId,
      name,
      price: price * quantity,
      quantity,
      startDate, // зберігаємо як рядок для спрощення порівняння або Timestamp
      endDate,
      status: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('rentals').add(rentalData);
    res.status(201).json({ id: docRef.id, ...rentalData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Обслуговування статики (фронтенду)
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  
  // Запуск важкої задачі через 10 секунд після старту, щоб не заважати Render Health Check
  setTimeout(() => {
    completeExpiredRentals();
  }, 10000);

  // Оновлення раз на добу
  setInterval(completeExpiredRentals, 24 * 60 * 60 * 1000);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});