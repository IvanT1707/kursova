import React from 'react';

function PaymentForm() {
  return (
    <section className="payment-form">
      <form>
        <h2>Оплата карткою</h2>
        <label htmlFor="card-number">Номер картки:</label>
        <input type="text" id="card-number" placeholder="XXXX XXXX XXXX XXXX" />
        
        <label htmlFor="card-name">Ім'я власника:</label>
        <input type="text" id="card-name" placeholder="Ім'я та прізвище" />
        
        <label htmlFor="expiry">Термін дії:</label>
        <input type="text" id="expiry" placeholder="MM/YY" />
        
        <label htmlFor="cvv">CVV:</label>
        <input type="text" id="cvv" placeholder="XXX" />
        
        <button className="hero-button">Оплатити</button>
      </form>
    </section>
  );
}

export default PaymentForm;
