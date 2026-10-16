import React from 'react';
import styled from 'styled-components';
import { useUiStore } from '../../stores/uiStore';
import { tokens } from '../../theme/designTokens';

import { SxProps, Theme } from '@mui/material';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  elevation?: 'flat' | 'glow';
  className?: string;
  sx?: SxProps<Theme>;
}

const StyledCard = styled.div<{ $mode: 'light' | 'dark'; $elevation: 'flat' | 'glow' }>`
  background: ${({ $mode }) => tokens[$mode].glassBg};
  border: 1px solid ${({ $mode }) => tokens[$mode].glassBorder};
  border-radius: ${tokens.radius.lg};
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  box-shadow: ${({ $elevation, $mode }) =>
    $elevation === 'glow'
      ? $mode === 'light'
        ? '0 12px 36px rgba(13, 92, 58, 0.12)'
        : '0 12px 36px rgba(16, 185, 129, 0.14)'
      : tokens.shadows.card};
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);

  &:hover {
    border-color: ${({ $mode }) =>
      $mode === 'light' ? 'rgba(13, 92, 58, 0.3)' : 'rgba(16, 185, 129, 0.38)'};
  }
`;

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  elevation = 'flat',
  className,
  ...props
}) => {
  const themeMode = useUiStore((s) => s.themeMode);

  return (
    <StyledCard $mode={themeMode} $elevation={elevation} className={className} {...props}>
      {children}
    </StyledCard>
  );
};
