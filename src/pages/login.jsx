import { useState } from 'react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import Header from '../components/Header';
import Footer from '../components/Footer';

const Login = () => {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm();

  const handleLogin = async (data) => {
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, data.email, data.password);
      toast.success("Вхід успішний");
      navigate('/');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Header />
      <main className="payment-form">
        <h2 style={{ textAlign: 'center' }}>Вхід</h2>
        <form onSubmit={handleSubmit(handleLogin)}>
          <div className="form-group">
            <input
              type="email"
              placeholder="Email"
              {...register('email', {
                required: 'Email обов\'язковий',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Некоректний email'
                }
              })}
              className={errors.email ? 'error' : ''}
            />
            {errors.email && <span className="error-message">{errors.email.message}</span>}
          </div>

          <div className="form-group">
            <input
              type="password"
              placeholder="Пароль"
              {...register('password', {
                required: 'Пароль обов\'язковий',
                minLength: {
                  value: 6,
                  message: 'Пароль має містити мінімум 6 символів'
                }
              })}
              className={errors.password ? 'error' : ''}
            />
            {errors.password && <span className="error-message">{errors.password.message}</span>}
          </div>

          <button type="submit" className="hero-button" disabled={isLoading}>
            {isLoading ? 'Вхід...' : 'Увійти'}
          </button>
        </form>
        <p style={{ marginTop: '15px', textAlign: 'center' }}>
          Ще не реєструвався? <Link to="/register">Зареєструйся</Link>
        </p>
      </main>
      <Footer />
    </>
  );
};

export default Login;
