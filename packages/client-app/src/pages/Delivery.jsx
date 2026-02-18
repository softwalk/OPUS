import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Delivery redirect — now handled by Pedir page with modo=delivery.
 */
export default function Delivery() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/pedir?modo=delivery', { replace: true });
  }, [navigate]);

  return null;
}
