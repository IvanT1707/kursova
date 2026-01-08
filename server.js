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

// Функція для автоматичного завершення оренд (оновлена для нової моделі)
async function completeExpiredRentals() {
  try {
    console.log('Checking for expired rentals...');
    const now = new Date();

    // Отримуємо всі активні оренди (щоб уникнути проблеми з індексами)
    const activeRentalsSnapshot = await db.collection('rentals')
      .where('status', '==', 'active')
      .get();

    if (activeRentalsSnapshot.empty) {
      console.log('No active rentals to check.');
      return;
    }

    const expiredRentals = [];
    const batch = db.batch();
    const equipmentUpdates = new Map();

    activeRentalsSnapshot.forEach(doc => {
      const rental = doc.data();
      const actualEndDate = rental.actualEndDate;

      // Перевіряємо, чи минув термін оренди
      if (actualEndDate && actualEndDate.toDate && actualEndDate.toDate() <= now) {
        expiredRentals.push(doc);
        batch.update(doc.ref, {
          status: 'completed',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        const currentQty = equipmentUpdates.get(rental.equipmentId) || 0;
        equipmentUpdates.set(rental.equipmentId, currentQty + (Number(rental.quantity) || 0));
      }
    });

    if (expiredRentals.length === 0) {
      console.log('No expired rentals to process.');
      return;
    }

    await batch.commit();

    for (const [id, qty] of equipmentUpdates) {
      await db.collection('equipment').doc(id).update({
        stock: admin.firestore.FieldValue.increment(qty)
      });
    }

    console.log(`Successfully completed ${expiredRentals.length} expired rentals.`);
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

app.post('/api/equipment', async (req, res) => {
  try {
    const { name, price, stock, category, image, detail } = req.body;
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    
    const token = authHeader.split(' ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    const equipmentData = {
      name,
      price: Number(price),
      stock: Number(stock),
      category: category || 'other',
      image: image || '',
      detail: detail || '',
      ownerId: decodedToken.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('equipment').add(equipmentData);
    res.status(201).json({ id: docRef.id, ...equipmentData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/equipment', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    console.log('\n========== GET /api/equipment ==========');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('❌ No valid auth header');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    console.log('Token received (first 30 chars):', token.substring(0, 30) + '...');
    
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
      console.log('✓ Token verified successfully');
    } catch (error) {
      console.log('❌ Token verification failed:', error.message);
      throw error;
    }
    
    const userId = decodedToken.uid;
    console.log(`\nDecoded user ID: ${userId}`);
    console.log(`Expected query: db.collection('equipment').where('ownerId', '==', '${userId}')`);
    
    // First, let's check all equipment to debug
    console.log('\n--- Checking ALL equipment in database ---');
    const allEquipmentSnapshot = await db.collection('equipment').get();
    console.log(`Total equipment documents in DB: ${allEquipmentSnapshot.size}`);
    const allEquipmentData = [];
    allEquipmentSnapshot.forEach(doc => {
      const data = doc.data();
      allEquipmentData.push({ id: doc.id, ownerId: data.ownerId, name: data.name });
      console.log(`  [${doc.id}] name: "${data.name}", ownerId: "${data.ownerId}"`);
    });
    
    // Now filter by user
    console.log(`\n--- Filtering for user: ${userId} ---`);
    const equipmentSnapshot = await db.collection('equipment').where('ownerId', '==', userId).get();
    
    console.log(`✓ Query returned ${equipmentSnapshot.size} documents`);
    
    const equipment = [];
    equipmentSnapshot.forEach(doc => {
      const docData = { id: doc.id, ...serializeDocumentData(doc.data()) };
      console.log(`  ✓ Equipment: "${docData.name}", ownerId: "${docData.ownerId}"`);
      equipment.push(docData);
    });

    console.log(`\n✓ Final response: ${equipment.length} items for user ${userId}\n`);
    res.json({ data: equipment });
  } catch (error) {
    console.error('❌ Error fetching equipment:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/equipment/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, stock, category, image, detail } = req.body;
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    
    const token = authHeader.split(' ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Get the equipment to check ownership
// Secure equipment deletion endpoint (owner only)
app.delete('/api/equipment/:id', async (req, res) => {
  try {
    const equipmentId = req.params.id;
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const userId = decodedToken.uid;
    const equipmentRef = db.collection('equipment').doc(equipmentId);
    const equipmentDoc = await equipmentRef.get();
    if (!equipmentDoc.exists) {
      return res.status(404).json({ error: 'Equipment not found' });
    }
    const equipmentData = equipmentDoc.data();
    if (equipmentData.ownerId !== userId) {
      return res.status(403).json({ error: 'Forbidden: Not the owner' });
    }
    await equipmentRef.delete();
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
    const equipmentRef = db.collection('equipment').doc(id);
    const equipmentDoc = await equipmentRef.get();
    
    if (!equipmentDoc.exists) {
      return res.status(404).json({ error: 'Equipment not found' });
    }
    
    const equipment = equipmentDoc.data();
    
    // Check if user owns this equipment
    if (equipment.ownerId !== decodedToken.uid) {
      return res.status(403).json({ error: 'You can only update your own equipment' });
    }
    
    const updateData = {
      name,
      price: Number(price),
      stock: Number(stock),
      category: category || 'other',
      image: image || '',
      detail: detail || '',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await equipmentRef.update(updateData);
    res.json({ id, ...updateData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/rentals', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const userId = decodedToken.uid;

    // Get rentals where user is either renter or owner
    const [renterRentals, ownerRentals] = await Promise.all([
      db.collection('rentals').where('userId', '==', userId).get(),
      db.collection('rentals').where('ownerId', '==', userId).get()
    ]);

    const allRentals = [];
    
    renterRentals.forEach(doc => {
      allRentals.push({ id: doc.id, ...serializeDocumentData(doc.data()), userRole: 'renter' });
    });
    
    ownerRentals.forEach(doc => {
      allRentals.push({ id: doc.id, ...serializeDocumentData(doc.data()), userRole: 'owner' });
    });

    res.json({ data: allRentals });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/rentals', async (req, res) => {
  try {
    const { equipmentId, durationDays, quantity, name, price } = req.body;
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    
    const token = authHeader.split(' ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Get equipment to check owner
    const equipmentRef = db.collection('equipment').doc(equipmentId);
    const equipmentDoc = await equipmentRef.get();
    
    if (!equipmentDoc.exists) {
      return res.status(404).json({ error: 'Equipment not found' });
    }
    
    const equipment = equipmentDoc.data();
    
    // Check if user is trying to rent their own equipment
    if (equipment.ownerId === decodedToken.uid) {
      return res.status(400).json({ error: 'Cannot rent your own equipment' });
    }
    
    // Validate durationDays
    if (!durationDays || durationDays < 1) {
      return res.status(400).json({ error: 'Invalid duration' });
    }
    
    const rentalData = {
      userId: decodedToken.uid,
      equipmentId,
      ownerId: equipment.ownerId,
      name,
      price: price * durationDays * quantity,
      quantity,
      durationDays,
      status: 'requested',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('rentals').add(rentalData);
    
    // Emulate email sending to owner
    console.log(`Email sent to owner ${equipment.ownerId}: New rental request for ${name}`);
    
    res.status(201).json({ id: docRef.id, ...rentalData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/rentals/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, trackingNumber, returnTrackingNumber } = req.body;
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    
    const token = authHeader.split(' ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    const rentalRef = db.collection('rentals').doc(id);
    const rentalDoc = await rentalRef.get();
    
    if (!rentalDoc.exists) {
      return res.status(404).json({ error: 'Rental not found' });
    }
    
    const rental = rentalDoc.data();
    
    // Check permissions based on status transition
    if (status === 'approved' && rental.ownerId !== decodedToken.uid) {
      return res.status(403).json({ error: 'Only owner can approve rental' });
    }
    
    if (status === 'shipped' && rental.ownerId !== decodedToken.uid) {
      return res.status(403).json({ error: 'Only owner can ship rental' });
    }
    
    if (status === 'active' && rental.userId !== decodedToken.uid) {
      return res.status(403).json({ error: 'Only renter can confirm receipt' });
    }
    
    if (status === 'returning' && rental.userId !== decodedToken.uid) {
      return res.status(403).json({ error: 'Only renter can return rental' });
    }
    
    if (status === 'completed' && rental.ownerId !== decodedToken.uid) {
      return res.status(403).json({ error: 'Only owner can complete rental' });
    }
    
    const updateData = {
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // Handle status-specific logic
    if (status === 'approved') {
      // Use transaction to check and decrement stock
      await db.runTransaction(async (transaction) => {
        const equipmentRef = db.collection('equipment').doc(rental.equipmentId);
        const equipmentDoc = await transaction.get(equipmentRef);
        
        if (!equipmentDoc.exists) {
          throw new Error('Equipment not found');
        }
        
        const equipment = equipmentDoc.data();
        if (equipment.stock < rental.quantity) {
          throw new Error('Not enough stock');
        }
        
        transaction.update(equipmentRef, { 
          stock: admin.firestore.FieldValue.increment(-rental.quantity) 
        });
      });
    } else if (status === 'shipped') {
      if (!trackingNumber) {
        return res.status(400).json({ error: 'Tracking number required for shipping' });
      }
      updateData.trackingNumber = trackingNumber;
    } else if (status === 'active') {
      updateData.actualStartDate = admin.firestore.FieldValue.serverTimestamp();
      const actualEndDate = new Date();
      actualEndDate.setDate(actualEndDate.getDate() + rental.durationDays);
      updateData.actualEndDate = admin.firestore.Timestamp.fromDate(actualEndDate);
    } else if (status === 'returning') {
      if (!returnTrackingNumber) {
        return res.status(400).json({ error: 'Return tracking number required' });
      }
      updateData.returnTrackingNumber = returnTrackingNumber;
    } else if (status === 'completed') {
      // Return stock to equipment
      const equipmentRef = db.collection('equipment').doc(rental.equipmentId);
      await equipmentRef.update({ 
        stock: admin.firestore.FieldValue.increment(rental.quantity) 
      });
    }
    
    await rentalRef.update(updateData);
    
    // Send notifications
    if (status === 'approved') {
      console.log(`Notification sent to renter ${rental.userId}: Rental approved`);
    } else if (status === 'shipped') {
      console.log(`Notification sent to renter ${rental.userId}: Item shipped with tracking ${trackingNumber}`);
    } else if (status === 'active') {
      console.log(`Notification sent to renter ${rental.userId}: Item received, rental active`);
    } else if (status === 'returning') {
      console.log(`Notification sent to owner ${rental.ownerId}: Item being returned with tracking ${returnTrackingNumber}`);
    } else if (status === 'completed') {
      console.log(`Notification sent to renter ${rental.userId}: Rental completed`);
    }
    
    res.json({ success: true, status });
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
  
  setTimeout(() => {
    completeExpiredRentals();
  }, 10000);

  // Оновлення раз на добу
  setInterval(completeExpiredRentals, 24 * 60 * 60 * 1000);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});