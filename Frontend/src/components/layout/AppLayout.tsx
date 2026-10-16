import React from 'react';
import styled from 'styled-components';
import { Sidebar, ModuleKey } from './Sidebar';
import { Header } from './Header';
import { useUiStore } from '../../stores/uiStore';
import { tokens } from '../../theme/designTokens';

interface AppLayoutProps {
  activeModule: ModuleKey;
  onSelectModule: (module: ModuleKey) => void;
  children: React.ReactNode;
}

const LayoutRoot = styled.div<{ $mode: 'light' | 'dark' }>`
  display: flex;
  min-height: 100vh;
  background-color: ${({ $mode }) => tokens[$mode].bgMain};
  color: ${({ $mode }) => tokens[$mode].textPrimary};
`;

const ContentArea = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
`;

const MainBody = styled.main`
  flex: 1;
  padding: 24px;
  overflow-y: auto;
`;

export const AppLayout: React.FC<AppLayoutProps> = ({
  activeModule,
  onSelectModule,
  children,
}) => {
  const themeMode = useUiStore((s) => s.themeMode);

  return (
    <LayoutRoot $mode={themeMode}>
      <Sidebar activeModule={activeModule} onSelectModule={onSelectModule} />
      <ContentArea>
        <Header />
        <MainBody>{children}</MainBody>
      </ContentArea>
    </LayoutRoot>
  );
};
