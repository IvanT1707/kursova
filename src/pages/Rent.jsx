import { useEffect, useState, useMemo } from 'react';
import EquipmentCard from '../components/EquipmentCard';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { createRental, getEquipment } from '../api';
import { toast } from 'react-toastify';

const Rent = () => {
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [equipmentList, setEquipmentList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name'); // name, price, stock
  const [sortOrder, setSortOrder] = useState('asc'); // asc, desc
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [availabilityFilter, setAvailabilityFilter] = useState('all'); // all, available, low-stock
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const navigate = useNavigate();

  const fetchToken = async () => {
    const user = auth.currentUser;
    return user ? await user.getIdToken() : null;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCheckedAuth(true); // Завжди дозволяємо перегляд сторінки
      // Не перенаправляємо неавторизованих користувачів
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchEquipment = async () => {
      try {
        const data = await getEquipment();
        
        if (!data || !Array.isArray(data)) {
          throw new Error('Invalid data format received from server');
        }
        
        // Basic validation of items
        const validData = data.filter(item => 
          item && 
          typeof item === 'object' && 
          item.id && 
          item.name
        );
        
        if (validData.length > 0) {
          setEquipmentList(validData);
          
          // Store in localStorage as a fallback
          try {
            localStorage.setItem('equipmentList', JSON.stringify(validData));
          } catch (e) {
            console.error('Error saving to localStorage:', e);
          }
        }
      } catch (err) {
        console.error('Помилка завантаження обладнання:', err);
        toast.error('Не вдалося завантажити обладнання');
        
        // Try to use cached data if available
        try {
          const cached = localStorage.getItem('equipmentList');
          if (cached) {
            const data = JSON.parse(cached);
            if (Array.isArray(data)) {
              const validData = data.filter(item => 
                item && 
                typeof item === 'object' && 
                item.id && 
                item.name
              );
              setEquipmentList(validData);
              toast.info('Показано збережені дані');
            }
          }
        } catch (e) {
          console.error('Error reading cached equipment:', e);
        }
      } finally {
        setIsLoading(false);
      }
    };

    if (checkedAuth) {
      fetchEquipment();
    } else {
      // If not authenticated, clear the list
      setEquipmentList([]);
    }
  }, [checkedAuth]);

  const handleRent = async (id, startDate, endDate, quantity, name, price) => {
    try {
      if (typeof price !== 'number' || price <= 0) {
        console.error('Некоректна ціна:', price);
        toast.error('Помилка: ціна обладнання недійсна');
        return;
      }

      await createRental({
        equipmentId: id,
        name,
        price: price,
        startDate,
        endDate,
        quantity
      });

      toast.success(`Оренда "${name}" успішно оформлена!`);
    } catch (err) {
      console.error('Помилка оформлення оренди:', err);
      // Error is already handled by the API interceptor
    }
  };

  // Функції для роботи з кошиком
  const addToCart = (item, startDate, endDate, quantity) => {
    const cartItem = {
      id: Date.now(), // Унікальний ID для кошика
      equipmentId: item.id,
      name: item.name,
      price: item.price,
      startDate,
      endDate,
      quantity,
      image: item.image,
      totalDays: Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) || 1,
      totalPrice: item.price * quantity * (Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) || 1)
    };

    setCart(prev => [...prev, cartItem]);
    toast.success(`${item.name} додано до кошика!`);
  };

  const removeFromCart = (cartItemId) => {
    setCart(prev => prev.filter(item => item.id !== cartItemId));
    toast.info('Товар видалено з кошика');
  };

  const clearCart = () => {
    setCart([]);
    toast.info('Кошик очищено');
  };

  const checkoutCart = async () => {
    if (cart.length === 0) {
      toast.warning('Кошик порожній');
      return;
    }

    try {
      // Оформляємо всі елементи кошика
      for (const item of cart) {
        await createRental({
          equipmentId: item.equipmentId,
          name: item.name,
          price: item.price,
          startDate: item.startDate,
          endDate: item.endDate,
          quantity: item.quantity
        });
      }

      toast.success(`Успішно оформлено ${cart.length} оренд(у/и)!`);
      setCart([]);
      setShowCart(false);
    } catch (err) {
      console.error('Помилка оформлення кошика:', err);
      toast.error('Помилка при оформленні замовлення');
    }
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const cartItemsCount = cart.length;

  const filteredAndSortedList = useMemo(() => {
    if (!Array.isArray(equipmentList)) return [];

    // Filter
    const filtered = equipmentList.filter(item => {
      if (!item || typeof item !== 'object') return false;

      const matchCategory = !selectedCategory || item.category === selectedCategory;
      const matchSearch = !searchTerm ||
        (item.name && item.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.detail && item.detail.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchPrice = (!priceRange.min || item.price >= parseInt(priceRange.min)) &&
                        (!priceRange.max || item.price <= parseInt(priceRange.max));

      const matchAvailability = availabilityFilter === 'all' ||
                               (availabilityFilter === 'available' && item.stock > 0) ||
                               (availabilityFilter === 'low-stock' && item.stock > 0 && item.stock <= 5);

      return matchCategory && matchSearch && matchPrice && matchAvailability;
    });

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case 'price':
          aValue = a.price || 0;
          bValue = b.price || 0;
          break;
        case 'stock':
          aValue = a.stock || 0;
          bValue = b.stock || 0;
          break;
        case 'name':
        default:
          aValue = (a.name || '').toLowerCase();
          bValue = (b.name || '').toLowerCase();
          break;
      }

      if (sortOrder === 'desc') {
        return aValue < bValue ? 1 : -1;
      }
      return aValue > bValue ? 1 : -1;
    });

    return sorted;
  }, [equipmentList, selectedCategory, searchTerm, sortBy, sortOrder, priceRange, availabilityFilter]);

  return (
    <>
      <Header />
      <main className="my-rent">
        {/* Кошик */}
        {showCart && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
              <div className="p-6 border-b">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Кошик оренди</h2>
                  <button
                    onClick={() => setShowCart(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-6 max-h-96 overflow-y-auto">
                {cart.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">Кошик порожній</p>
                ) : (
                  <div className="space-y-4">
                    {cart.map(item => (
                      <div key={item.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                        <img
                          src={item.image?.startsWith('/images/') ? item.image : `/images/${item.image}`}
                          alt={item.name}
                          className="w-16 h-16 object-cover rounded-lg"
                          onError={(e) => e.target.src = '/images/placeholder.png'}
                        />
                        <div className="flex-1">
                          <h3 className="font-semibold">{item.name}</h3>
                          <p className="text-sm text-gray-600">
                            {item.startDate} - {item.endDate} ({item.totalDays} днів)
                          </p>
                          <p className="text-sm text-gray-600">Кількість: {item.quantity}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-blue-600">{item.totalPrice} ₴</p>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="text-red-500 hover:text-red-700 text-sm mt-1"
                          >
                            Видалити
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-6 border-t bg-gray-50">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-lg font-bold">Загалом:</span>
                    <span className="text-2xl font-bold text-blue-600">{cartTotal} ₴</span>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={clearCart}
                      className="flex-1 btn btn-secondary"
                    >
                      Очистити кошик
                    </button>
                    <button
                      onClick={checkoutCart}
                      className="flex-1 btn btn-success"
                    >
                      Оформити замовлення
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Кнопка кошика */}
        {cartItemsCount > 0 && (
          <button
            onClick={() => setShowCart(true)}
            className="cart-button"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <span className="cart-count">
              {cartItemsCount}
            </span>
          </button>
        )}

        {/* Розширені фільтри */}
        <section className="filters">
          <div className="filter-row">
            <input
              type="text"
              className="search-input"
              placeholder="🔍 Пошук за назвою або описом..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />

            <select
              className="category-select"
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
            >
              <option value="">🏷️ Усі категорії</option>
              <option value="bike">🚴 Велосипеди</option>
              <option value="skate">⛸️ Ролики</option>
              <option value="kayak">🛶 Каное</option>
              <option value="other">🎯 Інше</option>
            </select>

            <select
              className="category-select"
              value={availabilityFilter}
              onChange={e => setAvailabilityFilter(e.target.value)}
            >
              <option value="all">📦 Уся наявність</option>
              <option value="available">✅ В наявності</option>
              <option value="low-stock">⚠️ Мало залишилось</option>
            </select>

            <div className="price-range">
              <input
                type="number"
                placeholder="Мін. ціна"
                className="price-input"
                value={priceRange.min}
                onChange={e => setPriceRange(prev => ({ ...prev, min: e.target.value }))}
              />
              <span className="price-separator">-</span>
              <input
                type="number"
                placeholder="Макс. ціна"
                className="price-input"
                value={priceRange.max}
                onChange={e => setPriceRange(prev => ({ ...prev, max: e.target.value }))}
              />
            </div>

            <select
              className="sort-select"
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
            >
              <option value="name">📝 За назвою</option>
              <option value="price">💰 За ціною</option>
              <option value="stock">📦 За наявністю</option>
            </select>

            <button
              className="sort-order-btn"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              title={sortOrder === 'asc' ? 'Змінити на спадання' : 'Змінити на зростання'}
            >
              {sortOrder === 'asc' ? '↑' : '↓'} {sortBy === 'price' ? 'Ціна' : sortBy === 'stock' ? 'Наявність' : 'Назва'}
            </button>
          </div>
        </section>

        <section className="equipment">
          <h1>Доступне обладнання</h1>
          {isLoading ? (
            <div className="loading">Завантаження обладнання...</div>
          ) : (
            <div className="equipment-grid">
              {filteredAndSortedList.length === 0 ? (
                <p>Немає обладнання за вибраними параметрами.</p>
              ) : (
                filteredAndSortedList
                  .filter(item => item && typeof item === 'object' && item.id)
                  .map(item => (
                    <EquipmentCard 
                      key={item.id} 
                      item={item} 
                      onRent={handleRent}
                      onAddToCart={addToCart}
                    />
                  ))
              )}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
};

export default Rent;