import { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { onAuthStateChanged, signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { getRentals } from '../api';

const Profile = () => {
  const [user, setUser] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [rentals, setRentals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const navigate = useNavigate();

  // Слідкуємо за входом
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const savedData = JSON.parse(localStorage.getItem(`profile_${currentUser.uid}`));
        if (savedData) {
          setName(savedData.name || '');
          setPhone(savedData.phone || '');
        }

        // Завантажуємо оренди користувача
        try {
          const rentalsData = await getRentals();
          setRentals(rentalsData.data || []);
        } catch (error) {
          console.error('Помилка завантаження оренд:', error);
        } finally {
          setIsLoading(false);
        }
      } else {
        navigate('/login');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  // Збереження даних для поточного користувача
  const handleSave = () => {
    if (user) {
      localStorage.setItem(`profile_${user.uid}`, JSON.stringify({ name, phone }));
      toast.success('Дані збережено успішно!');
    }
  };

  // Зміна пароля
  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Будь ласка, заповніть всі поля');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Нові паролі не співпадають');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Пароль має містити мінімум 6 символів');
      return;
    }

    try {
      // Перевірка поточного пароля
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Зміна пароля
      await updatePassword(user, newPassword);

      toast.success('Пароль успішно змінено!');
      setShowPasswordChange(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Помилка зміни пароля:', error);
      if (error.code === 'auth/wrong-password') {
        toast.error('Неправильний поточний пароль');
      } else {
        toast.error('Помилка зміни пароля: ' + error.message);
      }
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  // Статистика користувача
  const totalRentals = rentals.length;
  const activeRentals = rentals.filter(r => new Date(r.endDate) > new Date()).length;
  const totalSpent = rentals.reduce((sum, rental) => sum + (rental.price * rental.quantity), 0);

  return (
    <>
      <Header />
      <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', minHeight: '70vh' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '2rem', color: '#333' }}>Мій профіль</h1>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>

          {/* Інформація про користувача */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '2rem',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            border: '1px solid #e0e0e0'
          }}>
            <h2 style={{ marginBottom: '1.5rem', color: '#333', display: 'flex', alignItems: 'center', gap: '10px' }}>
              👤 Особиста інформація
            </h2>

            {user && (
              <div style={{ marginBottom: '1rem' }}>
                <p style={{ margin: '0.5rem 0', fontSize: '16px' }}>
                  <strong>Email:</strong> {user.email}
                </p>
                <p style={{ margin: '0.5rem 0', fontSize: '14px', color: '#666' }}>
                  <strong>Дата реєстрації:</strong> {user.metadata?.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString('uk-UA') : 'Невідомо'}
                </p>
              </div>
            )}

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Ім'я:</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Введіть ваше ім'я"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '16px',
                  marginBottom: '10px'
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Телефон:</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+380 XX XXX XX XX"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '16px'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button onClick={handleSave} className='hero-button' style={{ flex: '1', minWidth: '120px' }}>
                Зберегти
              </button>
              <button
                onClick={() => setShowPasswordChange(!showPasswordChange)}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#17a2b8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '600',
                  transition: 'all 0.3s ease',
                  flex: '1',
                  minWidth: '120px'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#138496'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#17a2b8'}
              >
                {showPasswordChange ? 'Сховати' : 'Змінити пароль'}
              </button>
            </div>

            {showPasswordChange && (
              <div style={{
                marginTop: '1rem',
                padding: '1rem',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                border: '1px solid #dee2e6'
              }}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Поточний пароль:</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Новий пароль:</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Підтвердити новий пароль:</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <button
                  onClick={handlePasswordChange}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    width: '100%'
                  }}
                >
                  Змінити пароль
                </button>
              </div>
            )}
          </div>

          {/* Статистика */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '2rem',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            border: '1px solid #e0e0e0'
          }}>
            <h2 style={{ marginBottom: '1.5rem', color: '#333', display: 'flex', alignItems: 'center', gap: '10px' }}>
              📊 Статистика
            </h2>

            {isLoading ? (
              <p>Завантаження...</p>
            ) : (
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div style={{
                  padding: '1rem',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#007bff' }}>
                    {totalRentals}
                  </div>
                  <div style={{ fontSize: '14px', color: '#666' }}>Загальна кількість оренд</div>
                </div>

                <div style={{
                  padding: '1rem',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#28a745' }}>
                    {activeRentals}
                  </div>
                  <div style={{ fontSize: '14px', color: '#666' }}>Активних оренд</div>
                </div>

                <div style={{
                  padding: '1rem',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ffc107' }}>
                    {totalSpent}₴
                  </div>
                  <div style={{ fontSize: '14px', color: '#666' }}>Загальна сума витрат</div>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Кнопка виходу */}
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <button onClick={handleLogout} className="cancel-button">
            Вийти з акаунту
          </button>
        </div>
      </main>
      <Footer />
    </>
  );
};

export default Profile;
