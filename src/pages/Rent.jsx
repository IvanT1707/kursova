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
      
      // toast.success(`Оренда "${name}" успішно оформлена!`); // Видалено, щоб уникнути дублювання повідомлень
    } catch (err) {
      console.error('Помилка оформлення оренди:', err);
      // Error is already handled by the API interceptor
    }
  };

  const filteredAndSortedList = useMemo(() => {
    if (!Array.isArray(equipmentList)) return [];
    
    // Filter
    const filtered = equipmentList.filter(item => {
      if (!item || typeof item !== 'object') return false;
      
      const matchCategory = !selectedCategory || item.category === selectedCategory;
      const matchSearch = !searchTerm || 
        (item.name && item.name.toLowerCase().includes(searchTerm.toLowerCase()));
      
      return matchCategory && matchSearch;
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
  }, [equipmentList, selectedCategory, searchTerm, sortBy, sortOrder]);

  return (
    <>
      <Header />
      <main className="my-rent">
        <section className="filters" style={{ padding: '1rem' }}>
          <div className="filter-row">
            <input
              type="text"
              className="search-input"
              placeholder="Пошук за назвою"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            <select
              className="category-select"
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
            >
              <option value="">Усі категорії</option>
              <option value="bike">Велосипеди</option>
              <option value="skate">Ролики</option>
              <option value="other">Інше</option>
            </select>
            <select
              className="sort-select"
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
            >
              <option value="name">Сортувати за назвою</option>
              <option value="price">Сортувати за ціною</option>
              <option value="stock">Сортувати за наявністю</option>
            </select>
            <button 
              className="sort-order-btn"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              title={sortOrder === 'asc' ? 'Змінити на спадання' : 'Змінити на зростання'}
            >
              {sortOrder === 'asc' ? '↑ Зростання' : '↓ Спадання'}
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