import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '../services/authService';
import { useTheme } from '../context/ThemeContext';

export default function ProfileScreen({ onLogout }) {
  const { theme } = useTheme();
  const [user, setUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [fullName, setFullName] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
      setFullName(currentUser?.user_metadata?.full_name || currentUser?.profile?.full_name || '');
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const handlePickAvatar = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) setAvatarFile(file);
    };
    input.click();
  };
// Handle profile update, including name and avatar
  const handleEditProfile = async () => {
    if (!fullName.trim()) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }
    setLoading(true);
    try {
      await authService.updateProfile(fullName, avatarFile);
      Alert.alert('Success', 'Profile updated');
      setShowEditModal(false);
      setAvatarFile(null);
      loadUser();
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };
// Handle password change with validation
  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Error', 'All fields are required');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await authService.updatePassword(null, newPassword);
      Alert.alert('Success', 'Password changed successfully');
      setShowPasswordModal(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };
  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await authService.signOut();
              onLogout();
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          }
        }
      ]
    );
  };

  const profileOptions = [
    { icon: 'person', title: 'Edit Profile', onPress: () => setShowEditModal(true) },
    { icon: 'lock-closed', title: 'Change Password', onPress: () => setShowPasswordModal(true) },
  ];
// Render user profile information and options to edit profile, change password, and logout. Modals are used for editing profile and changing password with appropriate validation and feedback.
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
        <Text style={[styles.profileName, { color: theme.text }]}>{user?.user_metadata?.full_name || user?.profile?.full_name || 'User'}</Text>
        <Text style={[styles.profileEmail, { color: theme.textSecondary }]}>{user?.email || 'No email'}</Text>
        {user?.profile?.role && (
          <View style={[styles.roleBadge, { backgroundColor: theme.primary }]}>
            <Text style={styles.roleText}>{user.profile.role.charAt(0).toUpperCase() + user.profile.role.slice(1)}</Text>
          </View>
        )}
      </View>

      <View style={[styles.optionsContainer, { backgroundColor: theme.card }]}>
        {profileOptions.map((option, index) => (
          <TouchableOpacity key={index} style={[styles.optionItem, { borderBottomColor: theme.borderLight }]} onPress={option.onPress}>
            <View style={styles.optionLeft}>
              <View style={[styles.optionIcon, { backgroundColor: theme.primary + '20' }]}>
                <Ionicons name={option.icon} size={20} color={theme.primary} />
              </View>
              <Text style={[styles.optionTitle, { color: theme.text }]}>{option.title}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={[styles.logoutButton, { backgroundColor: theme.card }]} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={theme.error} />
        <Text style={[styles.logoutText, { color: theme.error }]}>Logout</Text>
      </TouchableOpacity>

      <Modal visible={showEditModal} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Edit Profile</Text>
            <TouchableOpacity style={[styles.avatarPicker, { backgroundColor: theme.primary + '20' }]} onPress={handlePickAvatar}>
              <Ionicons name="camera" size={24} color={theme.primary} />
              <Text style={[styles.avatarPickerText, { color: theme.primary }]}>{avatarFile ? avatarFile.name : 'Choose Avatar'}</Text>
            </TouchableOpacity>
            <TextInput
              style={[styles.input, { backgroundColor: theme.borderLight, color: theme.text }]}
              placeholder="Full Name"
              placeholderTextColor={theme.textTertiary}
              value={fullName}
              onChangeText={setFullName}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.cancelButton, { backgroundColor: theme.borderLight }]} onPress={() => setShowEditModal(false)} disabled={loading}>
                <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveButton, { backgroundColor: theme.primary }]} onPress={handleEditProfile} disabled={loading}>
                <Text style={styles.saveButtonText}>{loading ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showPasswordModal} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Change Password</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.borderLight, color: theme.text }]}
              placeholder="New Password"
              placeholderTextColor={theme.textTertiary}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
            <TextInput
              style={[styles.input, { backgroundColor: theme.borderLight, color: theme.text }]}
              placeholder="Confirm New Password"
              placeholderTextColor={theme.textTertiary}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.cancelButton, { backgroundColor: theme.borderLight }]} onPress={() => setShowPasswordModal(false)} disabled={loading}>
                <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveButton, { backgroundColor: theme.primary }]} onPress={handleChangePassword} disabled={loading}>
                <Text style={styles.saveButtonText}>{loading ? 'Changing...' : 'Change'}</Text>
              </TouchableOpacity>
            </View>
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
    padding: 24,
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
  optionsContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    marginBottom: 32,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
    marginLeft: 8,
  },
  roleBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 8,
  },
  roleText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
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
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#6B7280',
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#10B981',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  avatarPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  avatarPickerText: {
    color: '#10B981',
    fontWeight: '600',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12,
  },
});
