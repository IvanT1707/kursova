import Header from '../components/Header';
import Footer from '../components/Footer';
import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <>
      <Header />
      <main className="hero-section">
        <div className="hero-content">
          <h1>Оренда спортивного обладнання легко та швидко!</h1>
          <h2>Обирайте найкраще спорядження для будь-яких втіх</h2>
          <div className="hero-actions">
            <Link to="/rent" className="hero-button">Орендуй зараз!</Link>
            <Link to="/register" className="cancel-button">Зареєструватися</Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
};

export default Home;