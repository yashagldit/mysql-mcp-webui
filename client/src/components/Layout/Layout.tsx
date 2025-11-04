import React from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
  activeConnection?: string;
  activeDatabase?: string;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  activeConnection,
  activeDatabase,
}) => {
  return (
    <div className="min-h-screen bg-gray-100">
      <Header activeConnection={activeConnection} activeDatabase={activeDatabase} />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
};
