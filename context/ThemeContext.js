import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

export const lightTheme = {
  background: '#FFFFFF',
  surface: '#F9FAFB',
  card: '#FFFFFF',
  primary: '#10B981',
  primaryDark: '#059669',
  text: '#1F2937',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
  gradient: ['#F0FDF4', '#DCFCE7'],
  headerGradient: ['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.8)'],
  primaryGradient: ['#10B981', '#059669'],
  shadow: '#000000',
  overlay: 'rgba(0,0,0,0.5)',
};

export const darkTheme = {
  background: '#0F172A',
  surface: '#1E293B',
  card: '#334155',
  primary: '#10B981',
  primaryDark: '#059669',
  text: '#F1F5F9',
  textSecondary: '#CBD5E1',
  textTertiary: '#94A3B8',
  border: '#475569',
  borderLight: '#334155',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
  gradient: ['#0F172A', '#1E293B'],
  headerGradient: ['rgba(15,23,42,0.95)', 'rgba(30,41,59,0.9)'],
  primaryGradient: ['#10B981', '#059669'],
  shadow: '#000000',
  overlay: 'rgba(0,0,0,0.7)',
};

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(false);
  const [theme, setTheme] = useState(lightTheme);

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const saved = await AsyncStorage.getItem('darkMode');
      if (saved !== null) {
        const isDarkMode = JSON.parse(saved);
        setIsDark(isDarkMode);
        setTheme(isDarkMode ? darkTheme : lightTheme);
      }
    } catch (error) {
      console.error('Load theme error:', error);
    }
  };

  const toggleTheme = async () => {
    try {
      const newIsDark = !isDark;
      setIsDark(newIsDark);
      setTheme(newIsDark ? darkTheme : lightTheme);
      await AsyncStorage.setItem('darkMode', JSON.stringify(newIsDark));
    } catch (error) {
      console.error('Toggle theme error:', error);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
