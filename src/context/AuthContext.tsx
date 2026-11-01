import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { syncUserPushToken } from '../lib/notificationService';

export type UserRole = 'Admin' | 'CRO' | 'Employee' | 'Staff' | 'Client' | null;

export interface AppUser {
  id?: string;
  name?: string;
  email: string;
  role: UserRole;
  department?: string;
  designation?: string;
}

interface AuthContextData {
  user: AppUser | null;
  role: UserRole;
  isAdmin: boolean;
  isStaff: boolean;
  isClient: boolean;
  loading: boolean;
  signInEmployee: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  signInClient: (emailOrPhone: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider = ({ children }: any) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAuth = async () => {
      try {
        const storedRole = await AsyncStorage.getItem('@user_role');
        const storedUser = await AsyncStorage.getItem('@user_data');
        if (storedRole && storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setRole(storedRole as UserRole);
          setUser(parsedUser);
          if (parsedUser?.id && storedRole !== 'Client') {
            syncUserPushToken(parsedUser.id);
          }
        }
      } catch (e) {
        console.error('Failed to load auth', e);
      } finally {
        setLoading(false);
      }
    };
    loadAuth();
  }, []);

  const signInEmployee = async (email: string, password?: string) => {
    try {
      const trimmedEmail = email.trim().toLowerCase();

      // 1. Check Supabase employees table
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .ilike('email', trimmedEmail)
        .single();

      if (error || !data) {
        // Fallback: Check if user typed dayalconstruction.office or admin
        if (trimmedEmail.includes('admin') || trimmedEmail.includes('dayalconstruction')) {
          const adminProfile: AppUser = {
            email: trimmedEmail,
            name: 'Admin',
            role: 'Admin',
            designation: 'Managing Director / Admin',
          };
          setRole('Admin');
          setUser(adminProfile);
          await AsyncStorage.setItem('@user_role', 'Admin');
          await AsyncStorage.setItem('@user_data', JSON.stringify(adminProfile));
          return { success: true };
        }
        return { success: false, error: 'Employee account not found for this email.' };
      }

      // Password check if provided in DB
      if (password && data.password && data.password !== password) {
        return { success: false, error: 'Incorrect password.' };
      }

      // Standardize role: Admin / CRO / Employee
      const rawRole = data.role || 'Employee';
      const normalizedRole: UserRole = rawRole.toLowerCase() === 'admin' ? 'Admin' : (rawRole === 'CRO' ? 'CRO' : 'Employee');

      const profile: AppUser = {
        id: data.id,
        name: data.name || (normalizedRole === 'Admin' ? 'Admin' : 'Employee'),
        email: data.email,
        role: normalizedRole,
        department: data.department,
        designation: data.designation,
      };

      setRole(normalizedRole);
      setUser(profile);
      await AsyncStorage.setItem('@user_role', normalizedRole);
      await AsyncStorage.setItem('@user_data', JSON.stringify(profile));

      if (profile.id) {
        syncUserPushToken(profile.id);
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Login failed' };
    }
  };

  const signInClient = async (emailOrPhone: string) => {
    try {
      const identifier = emailOrPhone.trim();
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .or(`email.ilike.${identifier},phone.ilike.${identifier}`)
        .limit(1);

      if (error || !data || data.length === 0) {
        return { success: false, error: 'Client record not found.' };
      }

      const client = data[0];
      const clientProfile: AppUser = {
        id: client.id,
        name: client.name || 'Valued Client',
        email: client.email || identifier,
        role: 'Client',
      };

      setRole('Client');
      setUser(clientProfile);
      await AsyncStorage.setItem('@user_role', 'Client');
      await AsyncStorage.setItem('@user_data', JSON.stringify(clientProfile));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Client login failed' };
    }
  };

  const signOut = async () => {
    setRole(null);
    setUser(null);
    await AsyncStorage.removeItem('@user_role');
    await AsyncStorage.removeItem('@user_data');
  };

  const isAdmin = role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'admin';
  const isStaff = isAdmin || role === 'Employee' || role === 'CRO' || role === 'Staff' || user?.role === 'Employee' || user?.role === 'CRO';
  const isClient = role === 'Client';

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAdmin,
        isStaff,
        isClient,
        loading,
        signInEmployee,
        signInClient,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
