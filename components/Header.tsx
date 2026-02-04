import React from 'react';
import { User } from '../types';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
  currentView: string;
  onChangeView: (view: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ user, onLogout, currentView, onChangeView }) => {
  return (
    <header className="w-full bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-2 sm:space-x-3 cursor-pointer" onClick={() => user && onChangeView('generator')}>
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-1.5 sm:p-2 rounded-lg text-white shadow-md">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-lg sm:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 truncate max-w-[200px] sm:max-w-none">
            SMILE AI VEO3
          </h1>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-4">
          {user ? (
            <div className="flex items-center gap-2 sm:gap-4">
              {user.role === 'admin' && (
                <button 
                  onClick={() => onChangeView(currentView === 'admin' ? 'generator' : 'admin')}
                  className={`text-xs sm:text-sm font-medium px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                    currentView === 'admin' 
                      ? 'bg-indigo-100 text-indigo-700' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {currentView === 'admin' ? 'Exit CMS' : 'Admin CMS'}
                </button>
              )}
              
              <div className="flex items-center gap-2 pl-2 sm:pl-4 border-l border-slate-200">
                <span className="text-sm font-medium text-slate-700 hidden sm:block max-w-[100px] truncate">
                  {user.username}
                </span>
                <button 
                  onClick={onLogout}
                  className="text-slate-400 hover:text-red-500 transition-colors p-1"
                  title="Logout"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider hidden sm:block">
              Authorized Access Only
            </div>
          )}
        </div>
      </div>
    </header>
  );
};