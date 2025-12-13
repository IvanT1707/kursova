import { Link } from 'react-router-dom';

function Footer() {
  return (
    <footer>
      <div className="footer-content">
        <div className="footer-column">
          <h3>Про нас</h3>
          <p>Сервіс оренди спортивного обладнання для активного відпочинку та тренувань.</p>
        </div>
        <div className="footer-column">
          <h3>Контакти</h3>
          <h4><i className="fas fa-envelope"></i> <a href="mailto:ivant@gmail.com">ivan@gmail.com</a></h4>
          <h4><i className="fas fa-phone-alt"></i> <a href="tel:+380683979271">+380 68 397 9271</a></h4>
        </div>
        <div className="footer-column">
          <h3>Навігація</h3>
          <ul>
            <li><Link to="/">Головна</Link></li>
            <li><Link to="/rent">Обладнання</Link></li>
            <li><Link to="/myrent">Мої оренди</Link></li>
            <li><Link to="/payment">Оплата</Link></li>
          </ul>
        </div>
      </div>
      <hr />
      <p>© 2025 SPORT RENT. Усі права захищено.</p>
    </footer>
  );
}

export default Footer;