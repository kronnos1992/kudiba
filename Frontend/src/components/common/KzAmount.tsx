import React from 'react';
import styled from 'styled-components';

interface KzAmountProps {
  value: number | string;
  decimals?: number;
  showCurrency?: boolean;
  className?: string;
}

const StyledMono = styled.span`
  font-family: var(--font-mono, 'IBM Plex Mono', monospace) !important;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  white-space: nowrap;
`;

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
  className,
}) => {
  const formatted = formatKwanza(value, decimals);

  return (
    <StyledMono className={className}>
      {formatted} {showCurrency ? 'Kz' : ''}
    </StyledMono>
  );
};
