import axios from 'axios';
import { toast } from 'react-toastify';

const api = axios.create({
  baseURL: process.env.NODE_ENV === 'production' 
    ? '/api' 
    : 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to include the auth token
api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    console.log('Request token (first 20 chars):', token.substring(0, 20) + '...');
  }
  // Disable caching
  config.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
  config.headers['Pragma'] = 'no-cache';
  config.headers['Expires'] = '0';
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Add a response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      toast.error('Будь ласка, увійдіть у систему');
      // Redirect to login after a short delay
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    } else if (error.response?.status === 403) {
      toast.error('Немає доступу до цієї операції');
    } else if (error.response?.status === 404) {
      toast.error('Ресурс не знайдено');
    } else if (error.response?.status >= 500) {
      toast.error('Помилка сервера. Спробуйте пізніше');
    } else if (error.code === 'NETWORK_ERROR') {
      toast.error('Помилка з\'єднання. Перевірте інтернет');
    } else {
      toast.error('Сталася помилка. Спробуйте ще раз');
    }
    return Promise.reject(error);
  }
);

// Helper function to get the current user's token
const getToken = async () => {
  const { auth } = await import('../firebase');
  const user = auth.currentUser;
  return user ? user.getIdToken() : null;
};

export const getEquipment = async () => {
  try {
    console.log('getEquipment: Fetching equipment...');
    const response = await api.get('/equipment');
    console.log('getEquipment: Response received:', response.data);
    let responseData = response.data;
    
    // Basic response validation
    if (!responseData) {
      console.error('Empty response from server');
      return [];
    }
    
    // Ensure we're working with an array
    let equipmentList = [];
    
    if (Array.isArray(responseData)) {
      equipmentList = responseData;
      console.log('Using response as direct array');
    } else if (responseData && typeof responseData === 'object') {
      if (Array.isArray(responseData.data)) {
        equipmentList = responseData.data;
        console.log('Using response.data as array');
      } else if (responseData.data && typeof responseData.data === 'object') {
        // Handle case where data is an object with numeric keys
        equipmentList = Object.values(responseData.data);
        console.log('Extracted array from response.data values');
      } else if (responseData) {
        equipmentList = [responseData];
        console.log('Wrapping single object in array');
      }
    }
    
    console.log(`Processing ${equipmentList.length} items...`);
    
    // Process each item with detailed logging
    const processedList = equipmentList
      .map((item, index) => {
        if (!item) {
          console.warn(`Item at index ${index} is null or undefined`);
          return null;
        }
        
        console.log(`Processing item ${index}:`, JSON.stringify(item, null, 2));
        
        const processedItem = {
          id: item.id || Math.random().toString(36).substr(2, 9),
          name: item.name || 'Без назви',
          price: Number(item.price) || 0,
          stock: Number(item.stock) || 0,
          category: item.category || 'other',
          image: item.image || '/images/placeholder.png',
          detail: item.detail || 'Опис відсутній',
          ownerId: item.ownerId, // IMPORTANT: Preserve ownerId for security checks
          createdAt: item.createdAt,
          updatedAt: item.updatedAt
        };
        
        console.log(`Processed item ${index}:`, processedItem);
        return processedItem;
      })
      .filter(Boolean); // Remove any null entries
    
    console.log('=== FINAL PROCESSED LIST ===');
    console.log(`Successfully processed ${processedList.length} items`);
    console.log('Processed items:', JSON.stringify(processedList, null, 2));
    
    return processedList;
  } catch (error) {
    console.error('Error fetching equipment:', error);
    // Повертаємо порожній масив замість викидання помилки
    return [];
  }
};

export const createEquipment = async (equipmentData) => {
  try {
    const response = await api.post('/equipment', equipmentData);
    return response.data;
  } catch (error) {
    console.error('Error creating equipment:', error);
    throw error;
  }
};

export const updateEquipment = async (equipmentId, equipmentData) => {
  try {
    const response = await api.put(`/equipment/${equipmentId}`, equipmentData);
    return response.data;
  } catch (error) {
    console.error('Error updating equipment:', error);
    throw error;
  }
};

// Delete equipment (owner only)
export const deleteEquipment = async (equipmentId) => {
  try {
    const response = await api.delete(`/equipment/${equipmentId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting equipment:', error);
    throw error;
  }
};

export const createRental = async (rentalData) => {
  try {
    const response = await api.post('/rentals', rentalData);
    return response.data;
  } catch (error) {
    console.error('Error creating rental:', error);
    throw error;
  }
};

export const getRentals = async (filters = {}) => {
  try {
    const params = new URLSearchParams();

    if (filters.minPrice !== undefined) {
      params.append('minPrice', filters.minPrice);
    }
    if (filters.maxPrice !== undefined) {
      params.append('maxPrice', filters.maxPrice);
    }

    const url = `/rentals${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await api.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching rentals:', error);
    throw error;
  }
};

export const updateRentalStatus = async (rentalId, statusData) => {
  try {
    const response = await api.put(`/rentals/${rentalId}/status`, statusData);
    return response.data;
  } catch (error) {
    console.error('Error updating rental status:', error);
    throw error;
  }
};

export default {
  getEquipment,
  createEquipment,
  updateEquipment,
  createRental,
  getRentals,
  updateRentalStatus,
};
