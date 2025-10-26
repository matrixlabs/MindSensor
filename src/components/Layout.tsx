import { type ReactNode } from 'react';
import Header from './Header';

interface LayoutProps {
  children: ReactNode;
  showBackButton?: boolean;
  className?: string;
}

export default function Layout({ children, showBackButton = false, className = '' }: LayoutProps) {
  return (
    <div className="min-h-screen bg-linear-to-b from-white/35 to-[#f5f6f7]/35">
      <Header showBackButton={showBackButton} />
      <main className={`w-full max-w-[1400px] mx-auto px-4 ${className}`}>
        {children}
      </main>
    </div>
  );
}

