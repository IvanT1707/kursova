import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import RentalCard from '../components/RentalCard';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { getRentals } from '../api';

const MyRent = () => {
  const [cart, setCart] = useState([]);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userToken, setUserToken] = useState(null);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState('name'); // name, price, startDate, endDate
  const [sortOrder, setSortOrder] = useState('asc'); // asc, desc
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (!checkedAuth) {
          alert('Будь ласка, увійдіть у систему');
          navigate('/login');
        }
        setUserToken(null);
      } else {
        setCheckedAuth(true);
        try {
          const token = await user.getIdToken();
          setUserToken(token);
        } catch (error) {
          console.error('Помилка отримання токена:', error);
          setError('Помилка авторизації');
        }
      }
    });

    return () => unsubscribe();
  }, [checkedAuth, navigate]);

  useEffect(() => {
    const fetchRentals = async () => {
      if (!userToken) {
        setCart([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        
        console.log('Fetching rentals from API...');
        
        const filters = {};
        if (minPrice) filters.minPrice = minPrice;
        if (maxPrice) filters.maxPrice = maxPrice;
        
        const result = await getRentals(filters);
        console.log('API response:', result);
        
        const rentals = result.data || [];
        
        // Process the rentals data
        const processedRentals = rentals.map(rental => {
          console.log('Processing rental:', rental);
          
          // Function to safely parse dates from various formats
          const parseDate = (dateValue) => {
            if (!dateValue) return new Date();
            
            try {
              // If it's a Firestore timestamp with toDate method
              if (dateValue.toDate && typeof dateValue.toDate === 'function') {
                return dateValue.toDate();
              }
              
              // If it's a Firestore timestamp object with seconds/nanoseconds
              if (dateValue.seconds !== undefined) {
                return new Date(dateValue.seconds * 1000 + (dateValue.nanoseconds || 0) / 1000000);
              }
              
              // If it's already a Date object
              if (dateValue instanceof Date) {
                return new Date(dateValue);
              }
              
              // If it's an ISO string
              const date = new Date(dateValue);
              return isNaN(date.getTime()) ? new Date() : date;
            } catch (error) {
              console.warn('Error parsing date:', dateValue, error);
              return new Date();
            }
          };
          
          // Parse dates first
          const startDate = parseDate(rental.startDate);
          const endDate = parseDate(rental.endDate);
          
          return {
            id: rental.id,
            name: String(rental.name || 'Без назви'),
            price: Number(rental.price) || 0,
            quantity: Number(rental.quantity) || 1,
            startDate,
            endDate,
            status: rental.status || 'active',
            userId: rental.userId,
            equipmentId: rental.equipmentId,
            category: rental.category || 'other',
            image: rental.image || ''
          };
        });

        console.log('Processed rentals:', processedRentals);
        setCart(processedRentals);
        
      } catch (err) {
        console.error('Помилка завантаження оренд:', err);
        setError('Не вдалося завантажити оренди. Спробуйте оновити сторінку.');
        setCart([]);
      } finally {
        setIsLoading(false);
      }
    };

    if (checkedAuth && userToken) {
      fetchRentals();
    } else {
      setCart([]);
      setIsLoading(false);
    }
  }, [checkedAuth, userToken, minPrice, maxPrice]);

  const filteredAndSortedRentals = useMemo(() => {
    if (!Array.isArray(cart)) return [];
    
    // Filter
    const filtered = cart.filter(rental => {
      if (!rental) return false;
      
      const matchPrice = (!minPrice || rental.price >= Number(minPrice)) && 
                        (!maxPrice || rental.price <= Number(maxPrice));
      const matchSearch = !searchTerm || 
        (rental.name && rental.name.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchCategory = !selectedCategory || rental.category === selectedCategory;
      
      return matchPrice && matchSearch && matchCategory;
    });
    
    // Sort
    const sorted = [...filtered].sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'price':
          aValue = a.price || 0;
          bValue = b.price || 0;
          break;
        case 'startDate':
          aValue = a.startDate || new Date(0);
          bValue = b.startDate || new Date(0);
          break;
        case 'endDate':
          aValue = a.endDate || new Date(0);
          bValue = b.endDate || new Date(0);
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
  }, [cart, minPrice, maxPrice, searchTerm, selectedCategory, sortBy, sortOrder]);

  const cancelRental = async (rentalId) => {
    const rentalToDelete = cart.find(r => r.id === rentalId);

    if (!rentalToDelete || !rentalToDelete.id) {
      alert('Помилка: не вдалося знайти оренду для скасування');
      return;
    }

    const confirmDelete = window.confirm('Ви впевнені, що хочете скасувати оренду?');
    if (!confirmDelete) return;

    try {
      const response = await fetch(`/api/rentals/${rentalToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Помилка видалення');
      }

      // Remove from local state
      const updatedCart = cart.filter(r => r.id !== rentalId);
      setCart(updatedCart);

      alert('Оренду скасовано');
    } catch (error) {
      console.error('Помилка при скасуванні оренди:', error);
      alert(`Не вдалося скасувати оренду: ${error.message}`);
    }
  };

  return (
    <>
      <Header />
      <main className='my-rent'>
        <section style={{ textAlign: 'center' }}>
          <h1 className="hero">Мої оренди</h1>
          <p>Перегляньте список активних та минулих оренд</p>
        </section>
        
        {/* Price filtering controls */}
        <div className="filters" style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: '15px', 
          margin: '20px 0',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label htmlFor="searchTerm">Пошук:</label>
            <input
              id="searchTerm"
              type="text"
              placeholder="Назва обладнання"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ccc', width: '150px' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label htmlFor="minPrice">Мін. ціна:</label>
            <input
              id="minPrice"
              type="number"
              placeholder="0"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ccc', width: '100px' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label htmlFor="maxPrice">Макс. ціна:</label>
            <input
              id="maxPrice"
              type="number"
              placeholder="∞"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ccc', width: '100px' }}
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ccc' }}
          >
            <option value="">Усі категорії</option>
            <option value="bike">Велосипеди</option>
            <option value="skate">Ролики</option>
            <option value="other">Інше</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ccc' }}
          >
            <option value="name">Сортувати за назвою</option>
            <option value="price">Сортувати за ціною</option>
            <option value="startDate">Сортувати за початком</option>
            <option value="endDate">Сортувати за закінченням</option>
          </select>
          <button 
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            style={{ 
              padding: '8px 16px', 
              backgroundColor: '#f0f0f0', 
              border: '1px solid #ccc', 
              borderRadius: '5px',
              cursor: 'pointer'
            }}
            title={sortOrder === 'asc' ? 'Змінити на спадання' : 'Змінити на зростання'}
          >
            {sortOrder === 'asc' ? '↑ Зростання' : '↓ Спадання'}
          </button>
          <button 
            onClick={() => {
              setSearchTerm('');
              setMinPrice('');
              setMaxPrice('');
              setSelectedCategory('');
              setSortBy('name');
              setSortOrder('asc');
            }}
            style={{ 
              padding: '8px 16px', 
              backgroundColor: '#f0f0f0', 
              border: '1px solid #ccc', 
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Очистити фільтри
          </button>
        </div>
        
        <div className="rent-list">
          {isLoading ? (
            <p style={{ textAlign: 'center' }}>Завантаження даних...</p>
          ) : error ? (
            <p style={{ textAlign: 'center', color: 'red' }}>{error}</p>
          ) : !Array.isArray(filteredAndSortedRentals) || filteredAndSortedRentals.length === 0 ? (
            <p style={{ textAlign: 'center' }}>Немає оренд за вибраними параметрами.</p>
          ) : (
            filteredAndSortedRentals.map((rental, index) => {
              if (!rental || !rental.id) {
                console.warn('Skipping invalid rental at index:', index, rental);
                return null;
              }
              
              console.log('Rendering rental:', rental);
              
              return (
                <RentalCard
                  key={rental.id}
                  rental={rental}
                  onCancel={() => cancelRental(rental.id)}
                />
              );
            })
          )}
        </div>
      </main>
      <Footer />
    </>
  );
};

export default MyRent;