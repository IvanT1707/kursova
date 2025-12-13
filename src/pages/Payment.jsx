import Header from '../components/Header';
import Footer from '../components/Footer';
import PaymentForm from '../components/PaymentForm';

function Payment() {
  return (
    <>
      <Header />
      <h1 className="hero" style={{ textAlign: 'center' }}>Оплата оренди</h1>
      <p style={{ textAlign: 'center' }}>Виберіть спосіб оплати та введіть необхідні дані</p>
      <main>
        <PaymentForm />
      </main>
      <Footer />
    </>
  );
}

export default Payment;
