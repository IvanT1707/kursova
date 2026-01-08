import { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { toast } from 'react-toastify';
import { updateEquipment } from '../api';

const EquipmentCard = ({ item, onRent, showEditButton = false }) => {
  console.log('Rendering EquipmentCard with item:', item);
  const [durationDays, setDurationDays] = useState(1);
  const [isRented, setIsRented] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: item?.name || '',
    price: item?.price || '',
    stock: item?.stock || '',
    category: item?.category || 'other',
    image: item?.image || '',
    detail: item?.detail || ''
  });

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsAuthenticated(!!user);
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  const handleRent = async () => {
    // Prevent multiple simultaneous requests
    if (isProcessing || isLoading) {
      return;
    }

    if (!isAuthenticated) {
      toast.info('Будь ласка, увійдіть у систему для оренди обладнання');
      return;
    }

    // Double-check current user is loaded
    if (!currentUser) {
      toast.error('Будь ласка, зачекайте завантаження профілю');
      return;
    }

    // Check if user is trying to rent their own equipment
    if (item.ownerId && item.ownerId === currentUser.uid) {
      toast.error('Ви не можете орендувати власне обладнання');
      return;
    }

    if (durationDays < 1) {
      toast.error('Кількість днів повинна бути не менше 1');
      return;
    }

    if (durationDays > item.stock) {
      toast.error('Кількість днів не може перевищувати наявний запас');
      return;
    }

    if (quantity > item.stock) {
      toast.error('Вибрана кількість перевищує наявність');
      return;
    }

    if (typeof item.price !== 'number' || item.price <= 0) {
      toast.error('Помилка: ціна обладнання недійсна');
      return;
    }

    const totalPrice = item.price * durationDays * quantity;

    setIsProcessing(true);
    setIsLoading(true);
    try {
      const token = await currentUser.getIdToken();
      if (!token) {
        toast.error('Будь ласка, увійдіть у систему');
        return;
      }

      await onRent(item.id, durationDays, quantity, item.name, item.price);

      setIsRented(true);
      setDurationDays(1);
      setQuantity(1);
      toast.success(`Оренда "${item.name}" створена успішно!`);

      // Reset the rented state after 2 seconds
      setTimeout(() => setIsRented(false), 2000);
    } catch (err) {
      console.error('Помилка при оренді:', err);
      toast.error(err.response?.data?.error || 'Помилка під час збереження оренди');
    } finally {
      setIsProcessing(false);
      setIsLoading(false);
    }
  };

  const handleEdit = () => {
    setEditForm({
      name: item.name || '',
      price: item.price || '',
      stock: item.stock || '',
      category: item.category || 'other',
      image: item.image || '',
      detail: item.detail || ''
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (isProcessing || isLoading) {
      return;
    }

    if (!editForm.name || !editForm.price || !editForm.stock) {
      toast.error('Будь ласка, заповніть обов\'язкові поля');
      return;
    }

    setIsProcessing(true);
    setIsLoading(true);
    try {
      await updateEquipment(item.id, editForm);
      toast.success('Обладнання оновлено успішно');
      setIsEditing(false);
      // Optionally, you could call a callback to refresh the equipment list
    } catch (error) {
      console.error('Error updating equipment:', error);
      toast.error('Помилка при оновленні обладнання');
    } finally {
      setIsProcessing(false);
      setIsLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  if (!item) {
    console.error('EquipmentCard received null or undefined item');
    return <div className="item">Помилка: відсутні дані про обладнання</div>;
  }

  // Функція для коректного відображення шляху до зображення
  const getImagePath = (imagePath) => {
    if (!imagePath) return '';
    // Уніфікуємо всі слеші
    let normalized = imagePath.replace(/\\/g, '/');
    // Якщо шлях починається з /images/, залишаємо як є
    if (normalized.startsWith('/images/')) return normalized;
    // Якщо шлях починається з ./, видаляємо крапку
    if (normalized.startsWith('./')) return normalized.substring(1);
    // Якщо шлях починається з ./, .\, \images/ або /images/ — видаляємо все до images
    normalized = normalized.replace(/^\.?\/?images\//, '/images/');
    // Якщо після цього не починається з /images/, додаємо
    if (!normalized.startsWith('/images/')) normalized = `/images/${normalized.replace(/^\/?/, '')}`;
    return normalized;
  };

  return (
    <div className="item">
      {isEditing ? (
        // Edit form
        <div>
          <h3>Редагувати обладнання</h3>
          <div style={{ display: 'grid', gap: '10px', marginBottom: '15px' }}>
            <input
              type="text"
              placeholder="Назва обладнання"
              value={editForm.name}
              onChange={(e) => setEditForm({...editForm, name: e.target.value})}
              style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
            />
            <input
              type="number"
              placeholder="Ціна за день"
              value={editForm.price}
              onChange={(e) => setEditForm({...editForm, price: e.target.value})}
              style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
            />
            <input
              type="number"
              placeholder="Кількість в наявності"
              value={editForm.stock}
              onChange={(e) => setEditForm({...editForm, stock: e.target.value})}
              style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
            />
            <select
              value={editForm.category}
              onChange={(e) => setEditForm({...editForm, category: e.target.value})}
              style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
            >
              <option value="bike">Велосипеди</option>
              <option value="skate">Ролики</option>
              <option value="other">Інше</option>
            </select>
            <input
              type="text"
              placeholder="URL зображення"
              value={editForm.image}
              onChange={(e) => setEditForm({...editForm, image: e.target.value})}
              style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
            />
            <textarea
              placeholder="Опис обладнання"
              value={editForm.detail}
              onChange={(e) => setEditForm({...editForm, detail: e.target.value})}
              style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', minHeight: '60px' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              onClick={handleSave}
              disabled={isLoading || isProcessing}
              style={{
                padding: '8px 16px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: (isLoading || isProcessing) ? 'not-allowed' : 'pointer'
              }}
            >
              {(isLoading || isProcessing) ? 'Збереження...' : 'Зберегти'}
            </button>
            <button
              onClick={handleCancelEdit}
              style={{
                padding: '8px 16px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              Скасувати
            </button>
          </div>
        </div>
      ) : (
        // Normal view
        <>
          <img 
            src={getImagePath(item.image)} 
            alt={item.name} 
            onError={(e) => {
              if (!e.target.dataset.placeholder) {
                console.error(`Failed to load image: ${item.image}`);
                e.target.src = '/images/placeholder.png';
                e.target.dataset.placeholder = 'true';
              }
            }}
          />
          <h3>{item.name}</h3>
          <p>Ціна: {item.price ?? 'Н/д'} грн/день</p>
          <p>В наявності: {item.stock === 0 ? '0 (немає в наявності)' : item.stock}</p>

          {!showEditButton && (
            <>
              <div className="duration-inputs">
                <label htmlFor={`duration-${item.id}`}>Кількість днів оренди:</label>
                <input
                  id={`duration-${item.id}`}
                  type="number"
                  min="1"
                  max={item.stock || 1}
                  value={durationDays}
                  onChange={(e) => setDurationDays(Math.max(1, Math.min(item.stock || 1, Number(e.target.value))))}
                  disabled={!isAuthenticated}
                  style={{ marginBottom: '10px', padding: '8px', width: '100px' }}
                />
                <input
                  type="range"
                  min="1"
                  max={item.stock || 1}
                  value={durationDays}
                  onChange={(e) => setDurationDays(Number(e.target.value))}
                  disabled={!isAuthenticated}
                  style={{ width: '100%', marginBottom: '10px' }}
                />
                <p><strong>Загальна вартість: {item.price * durationDays * quantity} грн</strong></p>
              </div>

              <div className="quantity-select">
                <label htmlFor={`quantity-${item.id}`}>Кількість:</label>
                <select
                  id={`quantity-${item.id}`}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  disabled={!isAuthenticated || item.stock === 0}
                >
                  {Array.from({ length: Math.min(item.stock || 1, 10) }, (_, i) => i + 1).map(num => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </select>
              </div>

              {!isAuthenticated && (
                <div className="auth-notice">
                  <p style={{ fontSize: '14px', color: '#666', textAlign: 'center', margin: '10px 0' }}>
                    Увійдіть у систему, щоб орендувати обладнання
                  </p>
                </div>
              )}
            </>
          )}

          <div className="detail">
            <strong>Деталі:</strong> <span className="detail-text">{item.detail}</span>
          </div>

          {showEditButton ? (
            <button
              className="edit-button"
              onClick={handleEdit}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                marginTop: '10px'
              }}
            >
              Редагувати
            </button>
          ) : (
            <button
              className={`rent-button ${isRented ? 'rented' : ''}`}
              onClick={handleRent}
              disabled={item.stock === 0 || isLoading || isProcessing || !isAuthenticated}
            >
              {isLoading || isProcessing
                ? 'Обробка...'
                : !isAuthenticated
                ? 'Увійдіть для оренди'
                : item.stock === 0
                ? 'Немає в наявності'
                : isRented
                ? 'Орендовано'
                : 'Орендувати'}
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default EquipmentCard;