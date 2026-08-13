'use client';

import React from 'react';
import { Route, Compass, RefreshCw, Sun, Moon } from 'lucide-react';

interface HeaderBarProps {
  isUpdatingMatrix: boolean;
  theme: 'light' | 'dark';
  onForceRebuild: () => void;
  onToggleTheme: () => void;
}

export default function HeaderBar({
  isUpdatingMatrix,
  theme,
  onForceRebuild,
  onToggleTheme,
}: HeaderBarProps) {
  return (
    <header className="h-11 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-3.5 text-sm select-none z-50 flex-shrink-0">
      {/* Left App Brand */}
      <div className="flex items-center gap-2.5">
        <div className="bg-emerald-500 text-white p-1.5 rounded-lg shadow-sm shadow-emerald-500/20">
          <Route className="w-4 h-4" />
        </div>
        <span className="font-extrabold tracking-tight text-sm text-zinc-900 dark:text-zinc-100">
          GigaSigmaRoute
        </span>
        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          v1.0 Desktop
        </span>
      </div>

      {/* Center Title */}
      <div className="hidden md:flex items-center gap-2 text-zinc-500 dark:text-zinc-400 font-medium text-xs cursor-default">
        <Compass className="w-4 h-4" />
        <span>Lokalny Optymalizator Tras & Macierz OSRM</span>
      </div>

      {/* Right Action Controls */}
      <div className="flex items-center gap-2">
        {/* OSRM Status */}
        <div className="hidden sm:flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800/80 px-2.5 py-1 rounded-full border border-zinc-200/80 dark:border-zinc-700/80 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
          <span>OSRM Engine</span>
        </div>

        {/* Refresh Matrix Button */}
        <button
          onClick={onForceRebuild}
          disabled={isUpdatingMatrix}
          title="Przebuduj macierz odległości dla wszystkich punktów"
          className="p-1.5 text-zinc-600 hover:text-indigo-500 dark:text-zinc-400 dark:hover:text-indigo-400 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 transition cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isUpdatingMatrix ? 'animate-spin' : ''}`} />
        </button>

        {/* Dark Mode Toggle */}
        <button
          onClick={onToggleTheme}
          title="Przełącz motyw Dark/Light"
          className="p-1.5 text-zinc-600 hover:text-emerald-500 dark:text-zinc-400 dark:hover:text-emerald-400 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 transition cursor-pointer"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
}
