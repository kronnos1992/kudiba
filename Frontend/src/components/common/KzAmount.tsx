import React from 'react';

interface KzAmountProps {
  value: number | string;
  decimals?: number;
  showCurrency?: boolean;
  className?: string;
}

export const formatKwanza = (value: number | string, decimals = 2): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0,00';

  const parts = num.toFixed(decimals).split('.');
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decimalPart = parts[1];

  return `${integerPart},${decimalPart}`;
};

export const KzAmount: React.FC<KzAmountProps> = ({
  value,
  decimals = 2,
  showCurrency = true,
  className = '',
}) => {
  const formatted = formatKwanza(value, decimals);

  return (
    <span className={`font-mono font-semibold tabular-nums whitespace-nowrap ${className}`}>
      {formatted} {showCurrency ? 'Kz' : ''}
    </span>
  );
};
