import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import RentalCard from '../components/RentalCard';
import EquipmentCard from '../components/EquipmentCard';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { getRentals, updateRentalStatus, createEquipment, getEquipment } from '../api';
import { toast } from 'react-toastify';

const MyRent = () => {
  const [cart, setCart] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userToken, setUserToken] = useState(null);
  const [activeTab, setActiveTab] = useState('tenant'); // tenant, owner-requests, owner-equipment, history
  const [showAddEquipment, setShowAddEquipment] = useState(false);
  const [newEquipment, setNewEquipment] = useState({
    name: '',
    price: '',
    stock: '',
    category: 'other',
    image: '',
    detail: ''
  });
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        // Clear all state when user logs out
        setUserToken(null);
        setCart([]);
        setEquipment([]);
        setCheckedAuth(true);
        if (checkedAuth) {
          alert('Будь ласка, увійдіть у систему');
          navigate('/login');
        }
      } else {
        setCheckedAuth(true);
        try {
          const token = await user.getIdToken();
          setUserToken(token);
          // Force clear state when user changes
          setCart([]);
          setEquipment([]);
        } catch (error) {
          console.error('Помилка отримання токена:', error);
          setError('Помилка авторизації');
        }
      }
    });

    return () => unsubscribe();
  }, [navigate]);

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
        
        const result = await getRentals(filters);
        console.log('API response:', result);
        
        const rentals = result.data || [];
        
        // Process the rentals data
        const processedRentals = rentals.map(rental => {
          console.log('Processing rental:', rental);
          
          // Function to safely parse dates from various formats
          const parseDate = (dateValue) => {
            if (!dateValue) return null;
            
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
              return isNaN(date.getTime()) ? null : date;
            } catch (error) {
              console.warn('Error parsing date:', dateValue, error);
              return null;
            }
          };
          
          return {
            id: rental.id,
            name: String(rental.name || 'Без назви'),
            price: Number(rental.price) || 0,
            quantity: Number(rental.quantity) || 1,
            durationDays: Number(rental.durationDays) || 1,
            status: rental.status || 'requested',
            userId: rental.userId,
            ownerId: rental.ownerId,
            equipmentId: rental.equipmentId,
            userRole: rental.userRole || 'renter',
            trackingNumber: rental.trackingNumber || '',
            returnTrackingNumber: rental.returnTrackingNumber || '',
            actualStartDate: parseDate(rental.actualStartDate),
            actualEndDate: parseDate(rental.actualEndDate),
            createdAt: parseDate(rental.createdAt),
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
  }, [checkedAuth, userToken]);

  useEffect(() => {
    const fetchEquipment = async () => {
      if (!userToken) {
        setEquipment([]);
        return;
      }

      try {
        console.log('Fetching equipment from API...');
        const result = await getEquipment();
        console.log('Equipment API response:', result);
        console.log('Current user token from auth:', auth.currentUser?.uid);
        
        const equipmentList = result || [];
        
        // SECURITY: Filter to show only equipment owned by current user
        const currentUserId = auth.currentUser?.uid;
        console.log(`Filtering equipment for user: ${currentUserId}`);
        const userEquipment = equipmentList.filter(item => {
          const isOwner = item.ownerId === currentUserId;
          if (!isOwner) {
            console.warn(`SECURITY: Filtering out equipment not owned by user. Item owner: ${item.ownerId}, Current user: ${currentUserId}`);
          }
          return isOwner;
        });
        console.log(`Equipment after security filter: ${userEquipment.length} items (was ${equipmentList.length})`);
        
        // Process the equipment data
        const processedEquipment = userEquipment.map(item => {
          console.log('Processing equipment item:', item);
          
          return {
            id: item.id,
            name: String(item.name || 'Без назви'),
            price: Number(item.price) || 0,
            stock: Number(item.stock) || 0,
            category: item.category || 'other',
            image: item.image || '',
            detail: item.detail || '',
            ownerId: item.ownerId,
            createdAt: item.createdAt
          };
        });

        console.log('Processed equipment:', processedEquipment);
        setEquipment(processedEquipment);
        
      } catch (err) {
        console.error('Помилка завантаження обладнання:', err);
        setEquipment([]);
      }
    };

    if (checkedAuth && userToken) {
      fetchEquipment();
    } else {
      setEquipment([]);
    }
  }, [checkedAuth, userToken]);

  const filteredRentals = useMemo(() => {
    if (!Array.isArray(cart)) return [];
    
    switch (activeTab) {
      case 'tenant':
        return cart.filter(rental => rental.userRole === 'renter' && !['completed', 'rejected', 'cancelled'].includes(rental.status));
      case 'owner-requests':
        return cart.filter(rental => rental.userRole === 'owner' && !['completed', 'rejected', 'cancelled'].includes(rental.status));
      case 'owner-equipment':
        return equipment; // Return equipment for editing
      case 'history':
        return cart.filter(rental => 
          ['completed', 'rejected', 'cancelled'].includes(rental.status)
        );
      default:
        return cart;
    }
  }, [cart, equipment, activeTab]);

  const handleStatusUpdate = async (rentalId, newStatus, extraData = {}) => {
    try {
      await updateRentalStatus(rentalId, { status: newStatus, ...extraData });
      toast.success(`Статус оренди оновлено на: ${newStatus}`);
      // Refresh rentals
      const result = await getRentals();
      const processedRentals = (result.data || []).map(rental => ({
        id: rental.id,
        name: String(rental.name || 'Без назви'),
        price: Number(rental.price) || 0,
        quantity: Number(rental.quantity) || 1,
        durationDays: Number(rental.durationDays) || 1,
        status: rental.status || 'requested',
        userId: rental.userId,
        ownerId: rental.ownerId,
        equipmentId: rental.equipmentId,
        userRole: rental.userRole || 'renter',
        trackingNumber: rental.trackingNumber || '',
        returnTrackingNumber: rental.returnTrackingNumber || '',
        createdAt: rental.createdAt,
        category: rental.category || 'other',
        image: rental.image || ''
      }));
      setCart(processedRentals);
    } catch (error) {
      console.error('Помилка при оновленні статусу:', error);
      toast.error('Не вдалося оновити статус оренди');
    }
  };

  const handleCreateEquipment = async () => {
    try {
      if (!newEquipment.name || !newEquipment.price || !newEquipment.stock) {
        toast.error('Будь ласка, заповніть обов\'язкові поля');
        return;
      }

      await createEquipment(newEquipment);
      toast.success('Обладнання додано успішно');
      
      setNewEquipment({
        name: '',
        price: '',
        stock: '',
        category: 'other',
        image: '',
        detail: ''
      });
      setShowAddEquipment(false);
    } catch (error) {
      console.error('Error creating equipment:', error);
      toast.error('Помилка при додаванні обладнання');
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
        
        {/* Tab Navigation */}
        <div className="tabs" style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          flexWrap: 'wrap',
          margin: '20px 0',
          borderBottom: '1px solid #ddd'
        }}>
          <button 
            className={`tab-button ${activeTab === 'tenant' ? 'active' : ''}`}
            onClick={() => setActiveTab('tenant')}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: activeTab === 'tenant' ? '#007bff' : '#f8f9fa',
              color: activeTab === 'tenant' ? 'white' : '#333',
              cursor: 'pointer',
              borderRadius: '5px 5px 0 0',
              marginRight: '5px'
            }}
          >
            Я орендую
          </button>
          <button 
            className={`tab-button ${activeTab === 'owner-requests' ? 'active' : ''}`}
            onClick={() => setActiveTab('owner-requests')}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: activeTab === 'owner-requests' ? '#007bff' : '#f8f9fa',
              color: activeTab === 'owner-requests' ? 'white' : '#333',
              cursor: 'pointer',
              borderRadius: '5px 5px 0 0',
              marginRight: '5px'
            }}
          >
            Запити на оренду
          </button>
          <button 
            className={`tab-button ${activeTab === 'owner-equipment' ? 'active' : ''}`}
            onClick={() => setActiveTab('owner-equipment')}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: activeTab === 'owner-equipment' ? '#007bff' : '#f8f9fa',
              color: activeTab === 'owner-equipment' ? 'white' : '#333',
              cursor: 'pointer',
              borderRadius: '5px 5px 0 0',
              marginRight: '5px'
            }}
          >
            Мої товари
          </button>
          <button 
            className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: activeTab === 'history' ? '#007bff' : '#f8f9fa',
              color: activeTab === 'history' ? 'white' : '#333',
              cursor: 'pointer',
              borderRadius: '5px 5px 0 0'
            }}
          >
            Історія
          </button>
        </div>
        
        <div className="rent-list">
          {activeTab === 'owner-equipment' && (
            <div style={{ marginBottom: '20px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3>Додати нове обладнання</h3>
                <button 
                  onClick={() => setShowAddEquipment(!showAddEquipment)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer'
                  }}
                >
                  {showAddEquipment ? 'Сховати' : 'Додати'}
                </button>
              </div>
              
              {showAddEquipment && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '15px' }}>
                  <input
                    type="text"
                    placeholder="Назва обладнання"
                    value={newEquipment.name}
                    onChange={(e) => setNewEquipment({...newEquipment, name: e.target.value})}
                    style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                  />
                  <input
                    type="number"
                    placeholder="Ціна за день"
                    value={newEquipment.price}
                    onChange={(e) => setNewEquipment({...newEquipment, price: e.target.value})}
                    style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                  />
                  <input
                    type="number"
                    placeholder="Кількість в наявності"
                    value={newEquipment.stock}
                    onChange={(e) => setNewEquipment({...newEquipment, stock: e.target.value})}
                    style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                  />
                  <select
                    value={newEquipment.category}
                    onChange={(e) => setNewEquipment({...newEquipment, category: e.target.value})}
                    style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                  >
                    <option value="bike">Велосипеди</option>
                    <option value="skate">Ролики</option>
                    <option value="other">Інше</option>
                  </select>
                  <input
                    type="text"
                    placeholder="URL зображення"
                    value={newEquipment.image}
                    onChange={(e) => setNewEquipment({...newEquipment, image: e.target.value})}
                    style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', gridColumn: '1 / -1' }}
                  />
                  <textarea
                    placeholder="Опис обладнання"
                    value={newEquipment.detail}
                    onChange={(e) => setNewEquipment({...newEquipment, detail: e.target.value})}
                    style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', gridColumn: '1 / -1', minHeight: '60px' }}
                  />
                  <button 
                    onClick={handleCreateEquipment}
                    style={{
                      padding: '10px',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      gridColumn: '1 / -1'
                    }}
                  >
                    Додати обладнання
                  </button>
                </div>
              )}
            </div>
          )}
          
          {isLoading ? (
            <p style={{ textAlign: 'center' }}>Завантаження даних...</p>
          ) : error ? (
            <p style={{ textAlign: 'center', color: 'red' }}>{error}</p>
          ) : !Array.isArray(filteredRentals) || filteredRentals.length === 0 ? (
            <p style={{ textAlign: 'center' }}>
              {activeTab === 'owner-requests' ? 'Немає запитів на оренду вашого обладнання.' : activeTab === 'owner-equipment' ? 'У вас немає доданого обладнання.' : 'Немає оренд у цій категорії.'}
            </p>
          ) : (
            filteredRentals.map((item, index) => {
              if (!item || !item.id) {
                console.warn('Skipping invalid item at index:', index, item);
                return null;
              }
              
              console.log('Rendering item:', item);
              
              if (activeTab === 'owner-equipment') {
                // Render equipment for editing
                return (
                  <EquipmentCard
                    key={item.id}
                    item={item}
                    showEditButton={true}
                    onDelete={() => {
                      // Refresh equipment list after deletion
                      setEquipment(equipment => equipment.filter(eq => eq.id !== item.id));
                    }}
                  />
                );
              } else {
                // Render rental
                return (
                  <RentalCard
                    key={item.id}
                    rental={item}
                    onCancel={() => handleStatusUpdate(item.id, 'cancelled')}
                    onStatusUpdate={handleStatusUpdate}
                    userRole={item.userRole}
                  />
                );
              }
            })
          )}
        </div>
      </main>
      <Footer />
    </>
  );
};

export default MyRent;