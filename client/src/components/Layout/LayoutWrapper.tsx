import React from 'react';
import { Layout } from './Layout';
import { useActiveState } from '../../hooks/useActiveState';

interface LayoutWrapperProps {
  children: React.ReactNode;
}

export const LayoutWrapper: React.FC<LayoutWrapperProps> = ({ children }) => {
  const { data: activeState } = useActiveState();

  return (
    <Layout
      activeConnection={activeState?.connectionName}
      activeDatabase={activeState?.database}
    >
      {children}
    </Layout>
  );
};
