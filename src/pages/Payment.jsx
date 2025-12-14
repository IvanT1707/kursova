import Header from '../components/Header';
import Footer from '../components/Footer';
import PaymentForm from '../components/PaymentForm';

const Payment = () => {
  return (
    <>
      <Header />
      <main className="profile-container">
        <div className="form-card">
          <h1>Оплата оренди</h1>
          <p>Виберіть спосіб оплати та введіть необхідні дані</p>
          <PaymentForm />
        </div>
      </main>
      <Footer />
    </>
  );
}

export default Payment;
