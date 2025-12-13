import { useEffect, useState, useCallback } from "react";
import { auth } from "../firebase";
import RentalCard from "./RentalCard";

const RentalList = ({ currentUser }) => {
  const [rentals, setRentals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRentals = useCallback(async () => {
    if (!currentUser) {
      setRentals([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/rentals', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setRentals(result.data || []);
    } catch (err) {
      console.error('Error fetching rentals:', err);
      setError('Не вдалося завантажити оренди');
      setRentals([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchRentals();
  }, [fetchRentals]);

  const handleCancel = async (id) => {
    if (!window.confirm('Ви впевнені, що хочете скасувати оренду?')) return;

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Не вдалося отримати токен авторизації');

      const response = await fetch(`/api/rentals/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Помилка видалення');
      }

      // Update local state
      setRentals(prev => prev.filter(rental => rental.id !== id));
      alert('Оренду скасовано');
    } catch (error) {
      console.error('Error canceling rental:', error);
      alert(`Не вдалося скасувати оренду: ${error.message}`);
    }
  };

  if (isLoading) {
    return <div>Завантаження...</div>;
  }

  if (error) {
    return <div style={{ color: 'red' }}>{error}</div>;
  }

  if (rentals.length === 0) {
    return <div>Наразі немає активних оренд.</div>;
  }

  return (
    <div className="rental-list" style={{ padding: '16px' }}>
      {rentals.map((rental) => (
        <RentalCard
          key={rental.id}
          rental={{
            ...rental,
            startDate: rental.startDate ? new Date(rental.startDate) : new Date(),
            endDate: rental.endDate ? new Date(rental.endDate) : new Date()
          }}
          onCancel={() => handleCancel(rental.id)}
        />
      ))}
    </div>
  );
};

export default RentalList;