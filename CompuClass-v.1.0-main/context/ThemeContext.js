import React, { createContext, useContext } from 'react';

const ThemeContext = createContext();

export const appTheme = {
  background: '#FFFFFF',
  surface: '#F3F4F6',
  card: '#FFFFFF',
  primary: '#2563EB',
  secondary: '#FACC15',
  accent: '#EF4444',
  success: '#22C55E',
  purple: '#8B5CF6',
  orange: '#F97316',
  text: '#111827',
  textSecondary: '#4B5563',
  textTertiary: '#9CA3AF',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  error: '#EF4444',
  warning: '#FACC15',
  overlay: 'rgba(0,0,0,0.5)',
};

export const ThemeProvider = ({ children }) => (
  <ThemeContext.Provider value={{ theme: appTheme }}>
    {children}
  </ThemeContext.Provider>
);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
