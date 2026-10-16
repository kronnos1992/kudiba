import React from 'react';
import styled from 'styled-components';
import { useUiStore } from '../../stores/uiStore';
import { tokens } from '../../theme/designTokens';

export type StatusType = 'ok' | 'medio' | 'critico' | 'acompanhar';

interface StatusBadgeProps {
  status: StatusType;
  label: string;
  size?: 'small' | 'medium';
}

const BadgeContainer = styled.span<{ $status: StatusType; $mode: 'light' | 'dark'; $size: 'small' | 'medium' }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: ${({ $size }) => ($size === 'small' ? '2px 8px' : '4px 12px')};
  border-radius: 9999px;
  font-size: ${({ $size }) => ($size === 'small' ? '11px' : '12px')};
  font-weight: 600;
  letter-spacing: 0.02em;
  background-color: ${({ $status, $mode }) => {
    const color = tokens[$mode].status[$status];
    return $mode === 'light' ? `${color}18` : `${color}28`;
  }};
  color: ${({ $status, $mode }) => tokens[$mode].status[$status]};
  border: 1px solid ${({ $status, $mode }) => {
    const color = tokens[$mode].status[$status];
    return `${color}40`;
  }};

  &::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: ${({ $status, $mode }) => tokens[$mode].status[$status]};
  }
`;

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, size = 'small' }) => {
  const themeMode = useUiStore((s) => s.themeMode);

  return (
    <BadgeContainer $status={status} $mode={themeMode} $size={size}>
      {label}
    </BadgeContainer>
  );
};
