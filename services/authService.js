import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';

export const authService = {
  async signUp(email, password, fullName, role = 'student') {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: role,
          },
        },
      });
      
      if (error) {
        console.error('❌ Sign up error:', error.message);
        throw error;
      }
      
      await AsyncStorage.setItem('user', JSON.stringify(data.user));
      await AsyncStorage.setItem('loginTimestamp', Date.now().toString());
      console.log('✅ Sign up successful:', email);
      return data;
    } catch (error) {
      console.error('❌ Sign up exception:', error);
      throw error;
    }
  },

  async signIn(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.error('❌ Sign in error:', error.message);
        throw error;
      }
      
      await AsyncStorage.setItem('user', JSON.stringify(data.user));
      await AsyncStorage.setItem('loginTimestamp', Date.now().toString());
      console.log('✅ Sign in successful:', email);
      return data;
    } catch (error) {
      console.error('❌ Sign in exception:', error);
      throw error;
    }
  },

  async signOut() {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Supabase signout error:', error);
    }
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('loginTimestamp');
  },

  async getCurrentUser() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (error) {
          console.error('❌ Get profile error:', error.message);
        }
        return { ...user, profile };
      }
      return user;
    } catch (error) {
      console.error('❌ Get current user exception:', error);
      throw error;
    }
  },

  async getOfflineUser() {
    try {
      const userJson = await AsyncStorage.getItem('user');
      return userJson ? JSON.parse(userJson) : null;
    } catch (error) {
      console.error('❌ Get offline user error:', error);
      return null;
    }
  },

  async isSessionValid() {
    const timestamp = await AsyncStorage.getItem('loginTimestamp');
    if (!timestamp) return false;
    
    const loginTime = parseInt(timestamp);
    const currentTime = Date.now();
    const thirtyMinutes = 30 * 60 * 1000;
    
    return (currentTime - loginTime) < thirtyMinutes;
  },

  async resetPassword(email) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) {
        console.error('❌ Reset password error:', error.message);
        throw error;
      }
      console.log('✅ Password reset email sent to:', email);
    } catch (error) {
      console.error('❌ Reset password exception:', error);
      throw error;
    }
  },

  async updateProfile(fullName, avatarFile = null) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let avatarUrl = null;

      if (avatarFile) {
        const fileName = `${user.id}/avatar_${Date.now()}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, avatarFile);
        if (uploadError) {
          console.error('❌ Avatar upload error:', uploadError.message);
          throw uploadError;
        }
        
        const { data: urlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);
        avatarUrl = urlData.publicUrl;
      }

      const updateData = { full_name: fullName };
      if (avatarUrl) updateData.avatar_url = avatarUrl;

      const { data, error } = await supabase.auth.updateUser({
        data: updateData
      });
      if (error) {
        console.error('❌ Update profile error:', error.message);
        throw error;
      }
      await AsyncStorage.setItem('user', JSON.stringify(data.user));
      console.log('✅ Profile updated successfully');
      return data;
    } catch (error) {
      console.error('❌ Update profile exception:', error);
      throw error;
    }
  },

  async updatePassword(currentPassword, newPassword) {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (error) {
        console.error('❌ Update password error:', error.message);
        throw error;
      }
      console.log('✅ Password updated successfully');
    } catch (error) {
      console.error('❌ Update password exception:', error);
      throw error;
    }
  },
};
