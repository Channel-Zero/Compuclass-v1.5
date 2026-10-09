import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';
import { assertUploadAllowed, createSignedFileUrl } from './fileAccess';
import { clearPerUserLocalData } from './userLocalData';
import { syncProgressOnSignIn } from './progressService';

const SESSION_LIMIT_MS = 30 * 60 * 1000;

async function rememberSignedInUser(user) {
  const previous = await AsyncStorage.getItem('user');
  let previousId = null;
  try { previousId = previous ? JSON.parse(previous)?.id : null; } catch {}
  if (previousId && previousId !== user?.id) await clearPerUserLocalData();
  await AsyncStorage.setItem('user', JSON.stringify(user));
  await AsyncStorage.setItem('loginTimestamp', Date.now().toString());
  await syncProgressOnSignIn();
}

export const authService = {
  async signUp(email, password, fullName) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });
      
      if (error) {
        console.error('❌ Sign up error:', error.message);
        throw error;
      }


      if (data.session) {
        await rememberSignedInUser(data.user);
      }
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
      
      await rememberSignedInUser(data.user);
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
    await clearPerUserLocalData();
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
        const storedAvatar = user.user_metadata?.avatar_path || user.user_metadata?.avatar_url;
        let avatarUrl = user.user_metadata?.avatar_url;
        if (storedAvatar) {
          try { avatarUrl = await createSignedFileUrl(storedAvatar); } catch (signError) {
            console.error('❌ Avatar URL error:', signError.message);
          }
        }
        return {
          ...user,
          profile,
          user_metadata: { ...user.user_metadata, avatar_url: avatarUrl },
        };
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

  async touchSession() {
    await AsyncStorage.setItem('loginTimestamp', Date.now().toString());
  },

  async isSessionValid() {
    const timestamp = await AsyncStorage.getItem('loginTimestamp');
    if (!timestamp) return false;

    const loginTime = parseInt(timestamp, 10);
    if (Number.isNaN(loginTime)) return false;
    return (Date.now() - loginTime) < SESSION_LIMIT_MS;
  },

  async resetPassword(email) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) {
        console.error('❌ Reset password error:', error.message);
        throw error;
      }
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
        assertUploadAllowed({ ...avatarFile, name: avatarFile.fileName || avatarFile.uri || 'avatar.jpg' });
        const fileName = `${user.id}/avatar_${Date.now()}.jpg`;
        const response = await fetch(avatarFile.uri);
        const arrayBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(fileName, uint8Array, { contentType: avatarFile.mimeType || 'image/jpeg' });
        if (uploadError) {
          console.error('❌ Avatar upload error:', uploadError.message);
          throw uploadError;
        }
        avatarUrl = fileName;
      }

      const updateData = { full_name: fullName };
      if (avatarUrl) updateData.avatar_path = avatarUrl;

      const { data, error } = await supabase.auth.updateUser({
        data: updateData
      });
      if (error) {
        console.error('❌ Update profile error:', error.message);
        throw error;
      }

      // Also update the profiles table so other screens see the new name
      await supabase.from('profiles').update({ full_name: fullName }).eq('id', user.id);

      const signedAvatar = avatarUrl ? await createSignedFileUrl(avatarUrl) : data.user?.user_metadata?.avatar_url;
      const storedUser = {
        ...data.user,
        user_metadata: { ...data.user?.user_metadata, avatar_url: signedAvatar },
      };
      await AsyncStorage.setItem('user', JSON.stringify(storedUser));
      return { ...data, user: storedUser };
    } catch (error) {
      console.error('❌ Update profile exception:', error);
      throw error;
    }
  },

  async updatePassword(currentPassword, newPassword) {
    try {
      if (!currentPassword) throw new Error('Current password is required');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error('Not signed in');
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (reauthError) throw new Error('Current password is incorrect');
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (error) {
        console.error('❌ Update password error:', error.message);
        throw error;
      }
      await this.touchSession();
    } catch (error) {
      console.error('❌ Update password exception:', error);
      throw error;
    }
  },
};
