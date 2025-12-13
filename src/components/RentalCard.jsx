// Function to safely convert any date-like object to a Date
const safeToDate = (dateLike) => {
  try {
    if (!dateLike) return new Date();
    
    // Handle Firestore Timestamp
    if (typeof dateLike === 'object' && dateLike !== null) {
      // If it has toDate method (Firestore Timestamp)
      if (typeof dateLike.toDate === 'function') {
        return dateLike.toDate();
      }
      // If it has seconds and (nanoseconds or nanoseconds === 0)
      if (typeof dateLike.seconds === 'number' && (dateLike.nanoseconds !== undefined)) {
        return new Date(dateLike.seconds * 1000 + Math.floor(dateLike.nanoseconds / 1000000));
      }
      // If it's already a Date object
      if (dateLike instanceof Date) {
        return new Date(dateLike);
      }
    }
    
    // Handle string dates
    if (typeof dateLike === 'string') {
      const parsed = new Date(dateLike);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    
    // Handle numeric timestamps
    if (typeof dateLike === 'number') {
      return new Date(dateLike);
    }
    
    console.warn('Could not parse date:', dateLike);
    return new Date();
  } catch (error) {
    console.error('Error parsing date:', error, 'Original value:', dateLike);
    return new Date();
  }
};

// Format price with 2 decimal places
const formatPrice = (price) => {
  const num = Number(price);
  return isNaN(num) ? '0.00' : num.toFixed(2);
};

const RentalCard = ({ rental, onCancel }) => {
  // Skip rendering if no valid rental data
  if (!rental || typeof rental !== 'object') {
    console.warn('Invalid rental data:', rental);
    return null;
  }
  
  // Extract with safe defaults
  const { 
    name = 'Назва не вказана',
    startDate: startDateRaw, 
    endDate: endDateRaw, 
    quantity = 1,
    price = 0
  } = rental;
  
  // Convert dates BEFORE any comparisons or rendering
  const startDate = safeToDate(startDateRaw);
  const endDate = safeToDate(endDateRaw);
  const now = new Date();
  
  // Validate converted dates
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    console.warn('Invalid dates after conversion:', { startDate, endDate, original: { startDateRaw, endDateRaw }});
    return (
      <div className="rental-card" style={{
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        padding: '16px',
        margin: '8px 0',
        backgroundColor: '#fff8f8',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ marginTop: 0, marginBottom: '12px', color: '#dc3545' }}>
          {String(name)}
        </h3>
        <p style={{ color: '#dc3545' }}>Помилка: Невалідні дати оренди</p>
      </div>
    );
  }
  
  // Check rental status
  const isExpired = endDate < now;
  const isUpcoming = startDate > now;
  const isActive = !isExpired && !isUpcoming;

  // Format date for display - ensure we return strings
  const formatDisplayDate = (date) => {
    try {
      const d = safeToDate(date);
      if (isNaN(d.getTime())) {
        return 'Невідома дата';
      }
      return d.toLocaleDateString('uk-UA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    } catch (error) {
      console.warn('Error formatting date:', error);
      return 'Невідома дата';
    }
  };

  return (
    <div className="rental-card" style={{
      border: '1px solid #e0e0e0',
      borderRadius: '8px',
      padding: '16px',
      margin: '8px 0',
      backgroundColor: isActive ? '#f8f9fa' : '#fff8f8',
      opacity: isExpired ? 0.7 : 1,
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      <h3 style={{ marginTop: 0, marginBottom: '12px', color: isExpired ? '#6c757d' : '#212529' }}>
        {String(name)}
      </h3>
      
      <div style={{ marginBottom: '8px' }}>
        <p style={{ margin: '4px 0' }}><strong>Початок:</strong> {formatDisplayDate(startDate)}</p>
        <p style={{ margin: '4px 0' }}><strong>Закінчення:</strong> {formatDisplayDate(endDate)}</p>
        <p style={{ margin: '4px 0' }}><strong>Кількість:</strong> {String(quantity)}</p>
        <p style={{ margin: '4px 0' }}><strong>Ціна:</strong> {formatPrice(price)} грн</p>
      </div>
      
      <div style={{ marginTop: '12px' }}>
        {isExpired ? (
          <span style={{ 
            color: '#dc3545',
            padding: '4px 8px',
            borderRadius: '4px',
            backgroundColor: '#ffebee',
            display: 'inline-block'
          }}>
            Завершено
          </span>
        ) : isUpcoming ? (
          <span style={{ 
            color: '#ffc107',
            padding: '4px 8px',
            borderRadius: '4px',
            backgroundColor: '#fff8e1',
            display: 'inline-block'
          }}>
            Очікується
          </span>
        ) : (
          <button 
            onClick={onCancel}
            style={{
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              fontWeight: '500'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#c82333'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#dc3545'}
          >
            Скасувати оренду
          </button>
        )}
      </div>
    </div>
  );
};

export default RentalCard;