import { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';

const Profile = () => {
  const [user, setUser] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const navigate = useNavigate();

// Слідкуємо за входом
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
    if (currentUser) {
      setUser(currentUser);
      const savedData = JSON.parse(localStorage.getItem(`profile_${currentUser.uid}`));
      if (savedData) {
        setName(savedData.name || '');
        setPhone(savedData.phone || '');
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
    alert('Дані збережено');
  }
};

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <>
      <Header />
      <div style={{ padding: '2rem', maxWidth: '400px', margin: '0 auto', minHeight: '70vh' }}>
        <h2>Мій профіль</h2>
        {user && (
          <p><strong>Email:</strong> {user.email}</p>
        )}

        <div style={{ marginBottom: '1rem' }}>
          <label>Ім’я:</label><br />
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ width: '100%', padding: '8px' }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label>Телефон:</label><br />
          <input
            type="text"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            style={{ width: '100%', padding: '8px' }}
          />
        </div>

        <button onClick={handleSave} className='hero-button'>Зберегти</button>
        <button onClick={handleLogout} className="cancel-button" style={{ marginTop: '1rem', marginLeft: '1rem' }}>
          Вийти
        </button>
      </div>
      <Footer />
    </>
  );
};

export default Profile;
