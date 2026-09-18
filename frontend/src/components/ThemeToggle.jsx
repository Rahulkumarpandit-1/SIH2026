import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export const ThemeToggle = ({ variant = 'header', showLabel = false }) => {
  const { theme, isDark, toggleTheme } = useTheme();

  if (variant === 'drawer') {
    return (
      <div className="theme-toggle-drawer-row">
        <div className="theme-drawer-meta">
          <span className="theme-drawer-title">Theme Mode</span>
          <span className="theme-drawer-sub">
            {isDark ? 'Dark Mode Active' : 'Light Mode Active'}
          </span>
        </div>
        <button
          className={`theme-segmented-switch ${isDark ? 'is-dark' : 'is-light'}`}
          onClick={toggleTheme}
          aria-label={`Switch to ${isDark ? 'Light' : 'Dark'} Mode (Shift+D)`}
          title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode (Shift+D)`}
          type="button"
        >
          <div className="theme-switch-slider" />
          <span className={`switch-icon-btn ${!isDark ? 'active' : ''}`} aria-hidden="true">
            <Sun size={14} />
          </span>
          <span className={`switch-icon-btn ${isDark ? 'active' : ''}`} aria-hidden="true">
            <Moon size={14} />
          </span>
        </button>
      </div>
    );
  }

  return (
    <button
      className={`theme-toggle-btn ${isDark ? 'is-dark' : 'is-light'}`}
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? 'Light' : 'Dark'} Mode (Shift+D)`}
      title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode (Shift+D)`}
      type="button"
      id="theme-toggle-button"
    >
      <div className="theme-toggle-track">
        <div className="theme-toggle-thumb">
          {isDark ? (
            <Moon size={14} className="theme-icon moon-icon" />
          ) : (
            <Sun size={14} className="theme-icon sun-icon" />
          )}
        </div>
        <span className="theme-icon-bg sun-side" aria-hidden="true">
          <Sun size={12} />
        </span>
        <span className="theme-icon-bg moon-side" aria-hidden="true">
          <Moon size={12} />
        </span>
      </div>
      {showLabel && (
        <span className="theme-toggle-label font-mono">
          {isDark ? 'DARK' : 'LIGHT'}
        </span>
      )}
    </button>
  );
};

export default ThemeToggle;
