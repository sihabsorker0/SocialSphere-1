import { ReactNode } from "react";
import Header from "./header";
import LeftSidebar from "./left-sidebar";
import RightSidebar from "./right-sidebar";
import MobileNav from "./mobile-nav";

interface MainLayoutProps {
  children: ReactNode;
  hideRightSidebar?: boolean;
}

export default function MainLayout({ children, hideRightSidebar = false }: MainLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-4 grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* Left sidebar (desktop only) */}
        <aside className="hidden md:block md:col-span-3 lg:col-span-2 space-y-4 sticky top-20 self-start">
          <LeftSidebar />
        </aside>
        
        {/* Main content */}
        <div className={`md:col-span-9 ${hideRightSidebar ? 'lg:col-span-10' : 'lg:col-span-7'} space-y-4`}>
          {children}
        </div>
        
        {/* Right sidebar (desktop only) */}
        {!hideRightSidebar && (
          <aside className="hidden lg:block lg:col-span-3 space-y-4 sticky top-20 self-start">
            <RightSidebar />
          </aside>
        )}
      </main>
      
      {/* Mobile Navigation */}
      <MobileNav />
    </div>
  );
}
