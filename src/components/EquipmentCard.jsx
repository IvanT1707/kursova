import { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { toast } from 'react-toastify';

const EquipmentCard = ({ item, onRent, onAddToCart }) => {
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

  const handleAddToCart = () => {
    if (!isAuthenticated) {
      toast.info('Будь ласка, увійдіть у систему для додавання до кошика');
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

    onAddToCart(item, startDate, endDate, quantity);
  };

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
    <div className="item fade-in">
      {/* Зображення з overlay */}
      <div className="relative">
        <img
          src={getImagePath(item.image)}
          alt={item.name}
          className="w-full h-48 object-cover rounded-t-xl transition-transform duration-300 hover:scale-105"
          onError={(e) => {
            console.error(`Failed to load image: ${item.image}`);
            e.target.src = '/images/placeholder.png';
          }}
        />

        {/* Статус наявності */}
        <div className="absolute top-3 right-3">
          {item.stock === 0 ? (
            <span className="status-badge status-error">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              Немає
            </span>
          ) : item.stock <= 5 ? (
            <span className="status-badge status-warning">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Мало ({item.stock})
            </span>
          ) : (
            <span className="status-badge status-success">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              В наявності
            </span>
          )}
        </div>
      </div>

      {/* Контент карточки */}
      <div className="p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-2 line-clamp-2">
          {item.name}
        </h3>

        <div className="flex items-center justify-between mb-4">
          <span className="text-2xl font-bold text-blue-600">
            {item.price ?? 'Н/д'} ₴
          </span>
          <span className="text-sm text-gray-500">за день</span>
        </div>

        {/* Деталі */}
        <div className="mb-4">
          <div className="text-sm text-gray-600 p-3 bg-gray-50 rounded-lg border-l-4 border-blue-500">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <span className="font-medium text-gray-700">Опис:</span>
                <p className="mt-1">{item.detail}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Форма дат */}
        <div className="space-y-3 mb-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="form-floating">
              <input
                type="date"
                id={`start-${item.id}`}
                className="w-full"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                disabled={!isAuthenticated}
                min={new Date().toISOString().split('T')[0]}
              />
              <label htmlFor={`start-${item.id}`}>Дата початку</label>
            </div>

            <div className="form-floating">
              <input
                type="date"
                id={`end-${item.id}`}
                className="w-full"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                disabled={!isAuthenticated}
                min={startDate || new Date().toISOString().split('T')[0]}
              />
              <label htmlFor={`end-${item.id}`}>Дата завершення</label>
            </div>
          </div>

          {/* Кількість */}
          <div className="quantity-select">
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Кількість: {quantity}
            </label>
            <input
              type="range"
              min="1"
              max={Math.min(item.stock, 10)}
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              disabled={!isAuthenticated}
            />
          </div>
        </div>

        {/* Повідомлення для неавторизованих */}
        {!isAuthenticated && (
          <div className="auth-notice p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-yellow-800">
                Увійдіть у систему, щоб орендувати обладнання
              </p>
            </div>
          </div>
        )}

        {/* Кнопки дій */}
        <div className="flex gap-3">
          <button
            className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-300 flex items-center justify-center gap-2 add-to-cart-btn ${
              (!isAuthenticated || item.stock === 0) ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg transform hover:-translate-y-0.5'
            }`}
            onClick={handleAddToCart}
            disabled={item.stock === 0 || isLoading || !isAuthenticated}
          >
            {isLoading ? (
              <>
                <div className="loading-spinner w-4 h-4 flex-shrink-0"></div>
                Додавання...
              </>
            ) : !isAuthenticated ? (
              <>
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.1 5H19M7 13l-1.1 5M7 13h10m0 0v8a2 2 0 01-2 2H9a2 2 0 01-2-2v-8z" />
                </svg>
                Увійдіть для кошика
              </>
            ) : item.stock === 0 ? (
              <>
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                Немає в наявності
              </>
            ) : (
              <>
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.1 5H19M7 13l-1.1 5M7 13h10m0 0v8a2 2 0 01-2 2H9a2 2 0 01-2-2v-8z" />
                </svg>
                Додати до кошика
              </>
            )}
          </button>
          <button
            className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-300 flex items-center justify-center gap-2 rent-btn ${
              isRented
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : ''
            } ${(!isAuthenticated || item.stock === 0) ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg transform hover:-translate-y-0.5'}`}
            onClick={handleRent}
            disabled={item.stock === 0 || isLoading || !isAuthenticated}
          >
            {isLoading ? (
              <>
                <div className="loading-spinner w-4 h-4 flex-shrink-0"></div>
                Обробка...
              </>
            ) : !isAuthenticated ? (
              <>
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                Увійдіть для оренди
              </>
            ) : item.stock === 0 ? (
              <>
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                Немає в наявності
              </>
            ) : isRented ? (
              <>
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Орендовано!
              </>
            ) : (
              <>
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                Орендувати
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EquipmentCard;