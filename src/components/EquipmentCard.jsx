import { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { toast } from 'react-toastify';

const EquipmentCard = ({ item, onRent }) => {
  console.log('Rendering EquipmentCard with item:', item);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isRented, setIsRented] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsAuthenticated(!!user);
    });
    return () => unsubscribe();
  }, []);

  const handleRent = async () => {
    if (!isAuthenticated) {
      toast.info('Будь ласка, увійдіть у систему для оренди обладнання');
      return;
    }

    if (!startDate || !endDate) {
      toast.error('Будь ласка, виберіть дату початку та завершення оренди');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      toast.error('Дата початку не може бути пізніше за дату завершення');
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

    const totalDays = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) || 1;
    const totalPrice = item.price * totalDays * quantity;

    setIsLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        toast.error('Будь ласка, увійдіть у систему');
        return;
      }

      await onRent(item.id, startDate, endDate, quantity, item.name, item.price);

      setIsRented(true);
      setStartDate('');
      setEndDate('');
      setQuantity(1);
      toast.success(`Оренда "${item.name}" створена успішно!`);

      // Reset the rented state after 2 seconds
      setTimeout(() => setIsRented(false), 2000);
    } catch (err) {
      console.error('Помилка при оренді:', err);
      toast.error(err.response?.data?.error || 'Помилка під час збереження оренди');
    } finally {
      setIsLoading(false);
    }
  };

  if (!item) {
    console.error('EquipmentCard received null or undefined item');
    return <div className="item">Помилка: відсутні дані про обладнання</div>;
  }

  // Функція для коректного відображення шляху до зображення
  const getImagePath = (imagePath) => {
    if (!imagePath) return '';
    // Якщо шлях починається з /images/, залишаємо як є
    if (imagePath.startsWith('/images/')) return imagePath;
    // Якщо шлях починається з ./, видаляємо крапку
    if (imagePath.startsWith('./')) return imagePath.substring(1);
    // В інших випадках додаємо /images/
    return `/images/${imagePath}`;
  };

  return (
    <div className="item">
      <img 
        src={getImagePath(item.image)} 
        alt={item.name} 
        onError={(e) => {
          console.error(`Failed to load image: ${item.image}`);
          e.target.src = '/images/placeholder.png'; // Додайте плейсхолдерне зображення
        }}
      />
      <h3>{item.name}</h3>
      <p>Ціна: {item.price ?? 'Н/д'} грн/день</p>
      <p>В наявності: {item.stock === 0 ? '0 (немає в наявності)' : item.stock}</p>

      <div className="date-inputs">
        <input
          type="date"
          className="start-date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          required
          disabled={!isAuthenticated}
        />
        <input
          type="date"
          className="end-date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          required
          disabled={!isAuthenticated}
        />
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

      <div className="detail">
        Деталі
        <span className="detail-text"> {item.detail}</span>
      </div>

      <button
        className={`rent-button ${isRented ? 'rented' : ''}`}
        onClick={handleRent}
        disabled={item.stock === 0 || isLoading || !isAuthenticated}
      >
        {isLoading
          ? 'Обробка...'
          : !isAuthenticated
          ? 'Увійдіть для оренди'
          : item.stock === 0
          ? 'Немає в наявності'
          : isRented
          ? 'Орендовано'
          : 'Орендувати'}
      </button>
    </div>
  );
};

export default EquipmentCard;