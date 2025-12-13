import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { auth } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';

function Header() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    window.location.href = '/login';
  };

  return (
    <header>
      <div className="logo">
        <img src="/images/SPORT.png" alt="Логотип сервісу оренди спорядження" className="logo-img" />
      </div>
      <nav>
        <ul>
          <li><Link to="/">Головна</Link></li>
          <li><Link to="/rent">Обладнання</Link></li>
          <li><Link to="/myrent">Мої оренди</Link></li>
          <li><Link to="/payment">Оплата</Link></li>

          {user ? (
            <>
              <li><Link to="/profile">Профіль</Link></li>
              <li>
                <span
                  onClick={handleLogout}
                >
                Вийти
                </span>
              </li>
            </>
          ) : (
            <>
              <li><Link to="/login">Увійти</Link></li>
              <li><Link to="/register">Реєстрація</Link></li>
            </>
          )}
        </ul>
      </nav>
    </header>
  );
}

export default Header;
