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

// Function to correctly display image path
const getImagePath = (imagePath) => {
  if (!imagePath) return '';
  // If path starts with /images/, leave as is
  if (imagePath.startsWith('/images/')) return imagePath;
  // If path starts with ./, remove dot
  if (imagePath.startsWith('./')) return imagePath.substring(1);
  // Otherwise add /images/
  return `/images/${imagePath}`;
};

// Status styling and text helpers
const getStatusStyle = (status) => {
  switch (status) {
    case 'requested':
      return { color: '#ffc107', backgroundColor: '#fff8e1' };
    case 'approved':
      return { color: '#007bff', backgroundColor: '#e7f3ff' };
    case 'shipped':
      return { color: '#17a2b8', backgroundColor: '#d1ecf1' };
    case 'active':
      return { color: '#28a745', backgroundColor: '#d4edda' };
    case 'returning':
      return { color: '#fd7e14', backgroundColor: '#ffeaa7' };
    case 'completed':
      return { color: '#28a745', backgroundColor: '#d4edda' };
    case 'rejected':
      return { color: '#dc3545', backgroundColor: '#f8d7da' };
    case 'cancelled':
      return { color: '#6c757d', backgroundColor: '#f8f9fa' };
    default:
      return { color: '#6c757d', backgroundColor: '#f8f9fa' };
  }
};

const getStatusText = (status) => {
  switch (status) {
    case 'requested': return 'Запитано';
    case 'approved': return 'Схвалено';
    case 'shipped': return 'Надіслано';
    case 'active': return 'Активна';
    case 'returning': return 'Повертається';
    case 'completed': return 'Завершено';
    case 'rejected': return 'Відхилено';
    case 'cancelled': return 'Скасовано';
    default: return 'Невідомий статус';
  }
};

// Button styles
const cancelButtonStyle = {
  backgroundColor: '#dc3545',
  color: 'white',
  border: 'none',
  padding: '8px 16px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: '600'
};

const actionButtonStyle = {
  backgroundColor: '#007bff',
  color: 'white',
  border: 'none',
  padding: '8px 16px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: '600'
};

const approveButtonStyle = {
  backgroundColor: '#28a745',
  color: 'white',
  border: 'none',
  padding: '8px 16px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: '600'
};

const rejectButtonStyle = {
  backgroundColor: '#dc3545',
  color: 'white',
  border: 'none',
  padding: '8px 16px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: '600'
};

const completeButtonStyle = {
  backgroundColor: '#17a2b8',
  color: 'white',
  border: 'none',
  padding: '8px 16px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: '600'
};

const RentalCard = ({ rental, onCancel, onStatusUpdate, userRole }) => {
  // Skip rendering if no valid rental data
  if (!rental || typeof rental !== 'object') {
    console.warn('Invalid rental data:', rental);
    return null;
  }
  
  // Extract with safe defaults
  const { 
    name = 'Назва не вказана',
    durationDays = 1,
    quantity = 1,
    price = 0,
    status = 'requested',
    userRole: rentalUserRole = 'renter',
    trackingNumber = '',
    returnTrackingNumber = '',
    actualStartDate,
    actualEndDate,
    image = ''
  } = rental;
  
  // Check rental status
  const isCompleted = status === 'completed';
  const isRejected = status === 'rejected';
  const isCancelled = status === 'cancelled';
  const isRequested = status === 'requested';
  const isApproved = status === 'approved';
  const isShipped = status === 'shipped';
  const isActive = status === 'active';
  const isReturning = status === 'returning';

  // Format date for display
  const formatDisplayDate = (date) => {
    if (!date) return 'Не встановлено';
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
      backgroundColor: isActive ? '#f8f9fa' : '#fff',
      opacity: isCompleted || isRejected || isCancelled ? 0.8 : 1,
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      {image && (
        <img 
          src={getImagePath(image)}
          alt={name} 
          style={{
            width: '100px',
            height: '100px',
            objectFit: 'cover',
            borderRadius: '4px',
            marginBottom: '12px',
            float: 'right'
          }}
          onError={(e) => {
            e.target.style.display = 'none';
          }}
        />
      )}
      <h3 style={{ marginTop: 0, marginBottom: '12px' }}>
        {String(name)}
      </h3>
      
      <div style={{ marginBottom: '8px' }}>
        <p style={{ margin: '4px 0' }}><strong>Тривалість:</strong> {durationDays} днів</p>
        <p style={{ margin: '4px 0' }}><strong>Кількість:</strong> {String(quantity)}</p>
        <p style={{ margin: '4px 0' }}><strong>Ціна:</strong> {formatPrice(price)} грн</p>
        {actualStartDate && (
          <p style={{ margin: '4px 0' }}><strong>Початок:</strong> {formatDisplayDate(actualStartDate)}</p>
        )}
        {actualEndDate && (
          <p style={{ margin: '4px 0' }}><strong>Закінчення:</strong> {formatDisplayDate(actualEndDate)}</p>
        )}
        {trackingNumber && (
          <p style={{ margin: '4px 0' }}><strong>ТТН відправки:</strong> {trackingNumber}</p>
        )}
        {returnTrackingNumber && (
          <p style={{ margin: '4px 0' }}><strong>ТТН повернення:</strong> {returnTrackingNumber}</p>
        )}
      </div>
      
      <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        {/* Status display */}
        <span style={{ 
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '14px',
          fontWeight: 'bold',
          ...getStatusStyle(status)
        }}>
          {getStatusText(status)}
        </span>
        
        {/* Action buttons based on status and user role */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {rentalUserRole === 'renter' && isRequested && (
            <button 
              onClick={() => onCancel && onCancel()}
              style={cancelButtonStyle}
            >
              Скасувати
            </button>
          )}
          
          {rentalUserRole === 'renter' && isShipped && (
            <button 
              onClick={() => onStatusUpdate && onStatusUpdate(rental.id, 'active')}
              style={actionButtonStyle}
            >
              Підтвердити отримання
            </button>
          )}
          
          {rentalUserRole === 'renter' && isActive && !returnTrackingNumber && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="text"
                placeholder="ТТН повернення"
                style={{ padding: '6px', border: '1px solid #ccc', borderRadius: '4px', width: '120px' }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && e.target.value.trim()) {
                    const now = new Date();
                    if (actualEndDate && now < new Date(actualEndDate)) {
                      if (!window.confirm('Ви повертаєте товар раніше терміну оренди. Ви впевнені?')) return;
                    }
                    onStatusUpdate && onStatusUpdate(rental.id, 'returning', { returnTrackingNumber: e.target.value.trim() });
                  }
                }}
              />
              <button
                onClick={() => {
                  const input = document.querySelector(`input[placeholder="ТТН повернення"]`);
                  if (input && input.value.trim()) {
                    const now = new Date();
                    if (actualEndDate && now < new Date(actualEndDate)) {
                      if (!window.confirm('Ви повертаєте товар раніше терміну оренди. Ви впевнені?')) return;
                    }
                    onStatusUpdate && onStatusUpdate(rental.id, 'returning', { returnTrackingNumber: input.value.trim() });
                  }
                }}
                style={actionButtonStyle}
              >
                Надіслати назад
              </button>
            </div>
          )}
          
          {rentalUserRole === 'owner' && isRequested && (
            <>
              <button 
                onClick={() => onStatusUpdate && onStatusUpdate(rental.id, 'approved')}
                style={approveButtonStyle}
              >
                Схвалити
              </button>
              <button 
                onClick={() => onStatusUpdate && onStatusUpdate(rental.id, 'rejected')}
                style={rejectButtonStyle}
              >
                Відхилити
              </button>
            </>
          )}
          
          {rentalUserRole === 'owner' && isApproved && !trackingNumber && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="text"
                placeholder="ТТН відправки"
                style={{ padding: '6px', border: '1px solid #ccc', borderRadius: '4px', width: '120px' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.target.value.trim()) {
                    onStatusUpdate && onStatusUpdate(rental.id, 'shipped', { trackingNumber: e.target.value.trim() });
                  }
                }}
              />
              <button 
                onClick={() => {
                  const input = document.querySelector(`input[placeholder="ТТН відправки"]`);
                  if (input && input.value.trim()) {
                    onStatusUpdate && onStatusUpdate(rental.id, 'shipped', { trackingNumber: input.value.trim() });
                  }
                }}
                style={actionButtonStyle}
              >
                Надіслати
              </button>
            </div>
          )}
          
          {rentalUserRole === 'owner' && isReturning && (
            <button 
              onClick={() => onStatusUpdate && onStatusUpdate(rental.id, 'completed')}
              style={completeButtonStyle}
            >
              Підтвердити отримання
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RentalCard;