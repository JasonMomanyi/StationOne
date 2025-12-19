import React, { ReactNode } from 'react';
import { APP_NAME, APP_VERSION } from '../constants';

interface LayoutProps {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const NavItem = ({ label, id, active, onClick }: { label: string; id: string; active: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`w-full text-left px-4 py-3 rounded-lg mb-1 transition-colors flex items-center justify-between group ${
      active 
        ? 'bg-survey-600 text-white shadow-lg shadow-survey-900/20' 
        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
    }`}
  >
    <span className="font-medium text-sm">{label}</span>
    {active && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
  </button>
);

const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange }) => {
  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col z-20 shadow-xl">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-survey-400 to-survey-600 rounded flex items-center justify-center font-bold text-white font-mono">
              S1
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight text-white">{APP_NAME}</h1>
              <p className="text-xs text-slate-500 font-mono tracking-wider">v{APP_VERSION}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="mb-6">
            <p className="px-4 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Computation</p>
            <NavItem id="traverse" label="Traverse / Survey" active={activeTab === 'traverse'} onClick={() => onTabChange('traverse')} />
          </div>

          <div className="mb-6">
            <p className="px-4 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Intelligence</p>
            <NavItem id="field-guide" label="Field Guide" active={activeTab === 'field-guide'} onClick={() => onTabChange('field-guide')} />
            <NavItem id="adjustments" label="Adjustments" active={activeTab === 'adjustments'} onClick={() => onTabChange('adjustments')} />
          </div>

          <div className="mb-6">
            <p className="px-4 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Support</p>
            <NavItem id="docs" label="Documentation" active={activeTab === 'docs'} onClick={() => onTabChange('docs')} />
          </div>
        </nav>

        <div className="p-4 border-t border-slate-800 text-xs text-slate-500">
          <p>Station One Engine: <span className="text-survey-400">Online</span></p>
          <p>Gemini AI: <span className="text-emerald-500">Ready</span></p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-950">
        {/* Header */}
        <header className="h-16 bg-slate-900/50 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-semibold text-white capitalize">{activeTab.replace('-', ' ')}</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-survey-900 text-survey-300 border border-survey-700">
              PROJECT: REF-2024-001
            </span>
          </div>
          <div className="flex items-center space-x-4">
             <button className="p-2 text-slate-400 hover:text-white transition-colors">
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
             </button>
             <div className="w-8 h-8 rounded-full bg-slate-700 border border-slate-600"></div>
          </div>
        </header>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-auto p-8 relative">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;