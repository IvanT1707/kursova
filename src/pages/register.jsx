import { useState } from 'react';
import { auth } from '../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import Header from '../components/Header';
import Footer from '../components/Footer';

const Register = () => {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors }, watch } = useForm();

  const handleRegister = async (data) => {
    setIsLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, data.email, data.password);
      toast.success("Реєстрація успішна");
      navigate('/login');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Header />
      <main className="profile-container">
        <div className="form-card">
          <h2>Реєстрація</h2>
          <form onSubmit={handleSubmit(handleRegister)}>
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

            <div className="form-group">
              <input
                type="password"
                placeholder="Підтвердіть пароль"
                {...register('confirmPassword', {
                  required: 'Підтвердження пароля обов\'язкове',
                  validate: value => value === watch('password') || 'Паролі не збігаються'
                })}
                className={errors.confirmPassword ? 'error' : ''}
              />
              {errors.confirmPassword && <span className="error-message">{errors.confirmPassword.message}</span>}
            </div>

            <button type="submit" className="hero-button" disabled={isLoading}>
              {isLoading ? 'Реєстрація...' : 'Зареєструватися'}
            </button>
          </form>
          <p className="auth-link">
            Вже зареєстрований? <Link to="/login">Заходь</Link>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
};

export default Register;
