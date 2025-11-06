import React, { useState } from 'react';
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <Header
        activeConnection={activeConnection}
        activeDatabase={activeDatabase}
        onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />
      <div className="flex">
        <Sidebar
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
        />
        <main className="flex-1 p-4 md:p-6 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
};
