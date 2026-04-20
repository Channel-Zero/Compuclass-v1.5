import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
  Modal,
  TextInput,
  Linking,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '../services/authService';
import { supabase } from '../config/supabase';
import { useTheme } from '../context/ThemeContext';

export default function SettingsScreen({ navigation }) {
  const { theme, isDark, toggleTheme } = useTheme();
  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [soundEffects, setSoundEffects] = useState(true);
  const [autoDownload, setAutoDownload] = useState(false);
  const [language, setLanguage] = useState('English');
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [cacheSize, setCacheSize] = useState('0 MB');

  useEffect(() => {
    loadSettings();
    loadUser();
    calculateCacheSize();
  }, []);

  const loadUser = async () => {
    const currentUser = await authService.getCurrentUser();
    setUser(currentUser);
  };

  const loadSettings = async () => {
    try {
      const settings = await AsyncStorage.multiGet([
        'notifications',
        'emailNotifications',
        'soundEffects',
        'autoDownload',
        'language',
      ]);
      settings.forEach(([key, value]) => {
        if (value !== null) {
          const parsed = key === 'language' ? value : JSON.parse(value);
          switch (key) {
            case 'notifications': setNotifications(parsed); break;
            case 'emailNotifications': setEmailNotifications(parsed); break;
            case 'soundEffects': setSoundEffects(parsed); break;
            case 'autoDownload': setAutoDownload(parsed); break;
            case 'language': setLanguage(parsed); break;
          }
        }
      });
    } catch (error) {
      console.error('Load settings error:', error);
    }
  };

  const saveSetting = async (key, value) => {
    try {
      await AsyncStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    } catch (error) {
      console.error('Save setting error:', error);
    }
  };

  const calculateCacheSize = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      let totalSize = 0;
      for (const key of keys) {
        const value = await AsyncStorage.getItem(key);
        if (value) totalSize += value.length;
      }
      setCacheSize(`${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    } catch (error) {
      setCacheSize('0 MB');
    }
  };

  const handleClearCache = async () => {
    Alert.alert(
      'Clear Cache',
      'This will remove temporary files. Your account data will be preserved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            const keysToKeep = ['user', 'loginTimestamp', 'notifications', 'soundEffects', 'darkMode', 'language'];
            const allKeys = await AsyncStorage.getAllKeys();
            const keysToRemove = allKeys.filter(key => !keysToKeep.includes(key));
            await AsyncStorage.multiRemove(keysToRemove);
            calculateCacheSize();
            Alert.alert('Success', 'Cache cleared');
          },
        },
      ]
    );
  };

  const handleExportData = async () => {
    try {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      const exportData = {
        user: { email: user.email, name: user.user_metadata?.full_name },
        profile,
        exportDate: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `compuclass_data_${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);
      Alert.alert('Success', 'Data exported');
    } catch (error) {
      Alert.alert('Error', 'Failed to export data');
    }
  };



  const languages = ['English', 'Spanish', 'French', 'German', 'Arabic', 'Chinese'];

  const settingsOptions = [
    {
      title: 'Preferences',
      items: [
        {
          icon: 'moon',
          title: 'Dark Mode',
          subtitle: 'Switch to dark theme',
          hasSwitch: true,
          value: isDark,
          onToggle: toggleTheme,
        },
      ],
    },
    {
      title: 'About',
      items: [
        {
          icon: 'information-circle',
          title: 'About CompuClass',
          subtitle: 'Version 1.0.0',
          onPress: () => Alert.alert('CompuClass', 'Version 1.0.0\n\nInteractive Computer Learning Platform\n\n© 2025 CompuClass'),
        },
      ],
    },
  ];

  const renderSettingItem = (item, index) => (
    <TouchableOpacity
      key={index}
      style={[styles.settingItem, { borderBottomColor: theme.borderLight }]}
      onPress={item.onPress}
      disabled={item.hasSwitch}
    >
      <View style={styles.settingItemLeft}>
        <View style={[styles.settingIcon, { backgroundColor: item.danger ? '#FEE2E2' : theme.primary + '20' }]}>
          <Ionicons name={item.icon} size={20} color={item.danger ? theme.error : theme.primary} />
        </View>
        <View style={styles.settingContent}>
          <Text style={[styles.settingTitle, { color: item.danger ? theme.error : theme.text }]}>{item.title}</Text>
          <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>{item.subtitle}</Text>
        </View>
      </View>
      <View style={styles.settingItemRight}>
        {item.hasSwitch ? (
          <Switch
            value={item.value}
            onValueChange={item.onToggle}
            trackColor={{ false: '#E5E7EB', true: '#A7F3D0' }}
            thumbColor={item.value ? '#10B981' : '#F3F4F6'}
          />
        ) : (
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.surface }]}>
      <View style={[styles.profileSection, { backgroundColor: theme.card }]}>
        {user?.user_metadata?.avatar_url ? (
          <Image source={{ uri: user.user_metadata.avatar_url }} style={styles.avatarImage} />
        ) : (
          <View style={[styles.profileAvatar, { backgroundColor: theme.primary }]}>
            <Ionicons name="person" size={40} color="#fff" />
          </View>
        )}
        <Text style={[styles.profileName, { color: theme.text }]}>{user?.user_metadata?.full_name || 'User'}</Text>
        <Text style={[styles.profileEmail, { color: theme.textSecondary }]}>{user?.email || 'No email'}</Text>
      </View>

      {/* Settings Sections */}
      {settingsOptions.map((section, sectionIndex) => (
        <View key={sectionIndex} style={styles.settingsSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{section.title}</Text>
          <View style={[styles.settingsGroup, { backgroundColor: theme.card }]}>
            {section.items.map((item, itemIndex) => renderSettingItem(item, itemIndex))}
          </View>
        </View>
      ))}

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: theme.textSecondary }]}>CompuClass - Interactive Computer Learning</Text>
        <Text style={[styles.footerVersion, { color: theme.textTertiary }]}>Version 1.0.0</Text>
      </View>

      <Modal visible={showLanguageModal} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Select Language</Text>
            {languages.map((lang) => (
              <TouchableOpacity
                key={lang}
                style={[styles.languageOption, { borderBottomColor: theme.borderLight }]}
                onPress={() => {
                  setLanguage(lang);
                  saveSetting('language', lang);
                  setShowLanguageModal(false);
                }}
              >
                <Text style={[styles.languageText, { color: theme.text }]}>{lang}</Text>
                {language === lang && <Ionicons name="checkmark" size={24} color="#10B981" />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: theme.borderLight }]}
              onPress={() => setShowLanguageModal(false)}
            >
              <Text style={[styles.closeButtonText, { color: theme.textSecondary }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0FDF4',
  },
  profileSection: {
    backgroundColor: '#fff',
    paddingTop: 40,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#6B7280',
  },
  settingsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 16,
    marginBottom: 8,
  },
  settingsGroup: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  settingItemRight: {
    marginLeft: 12,
  },
  footer: {
    padding: 24,
    alignItems: 'center',
    marginBottom: 32,
  },
  footerVersion: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#1F2937',
  },
  languageOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  languageText: {
    fontSize: 16,
    color: '#1F2937',
  },
  closeButton: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12,
  },
});