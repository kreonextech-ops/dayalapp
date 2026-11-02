import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { syncUserPushToken } from '../lib/notificationService';

export type UserRole = 'Admin' | 'CRO' | 'Employee' | 'Staff' | 'Client' | null;

export interface AppUser {
  id?: string;
  clientId?: string;
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
  signInClient: (identifier: string, password?: string) => Promise<{ success: boolean; error?: string }>;
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
            syncUserPushToken(parsedUser.id, storedRole);
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

      // STRICT: Client accounts CANNOT log in from the Staff Login portal
      if (data.role === 'Client') {
        return {
          success: false,
          error: 'This account is for the Client Portal. Please use Client Login to access your project dashboard.',
        };
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
        syncUserPushToken(profile.id, normalizedRole);
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Login failed' };
    }
  };

  const signInClient = async (identifier: string, password?: string) => {
    try {
      const trimmed = identifier.trim().toLowerCase();

      // 1. Primary check: employees table where role = 'Client'
      const { data: empClient } = await supabase
        .from('employees')
        .select('*')
        .ilike('email', trimmed)
        .eq('role', 'Client')
        .maybeSingle();

      if (empClient) {
        if (password && empClient.password && empClient.password !== password) {
          return { success: false, error: 'Incorrect password.' };
        }

        const clientId = empClient.department;
        let clientDisplayName = empClient.name;

        // Fetch client name & info from clients table if linked
        if (clientId) {
          const { data: cData } = await supabase
            .from('clients')
            .select('name')
            .eq('id', clientId)
            .maybeSingle();
          if (cData?.name) clientDisplayName = cData.name;
        }

        const clientProfile: AppUser = {
          id: empClient.id,
          clientId: clientId || empClient.id,
          name: clientDisplayName || 'Valued Client',
          email: empClient.email,
          role: 'Client',
        };

        setRole('Client');
        setUser(clientProfile);
        await AsyncStorage.setItem('@user_role', 'Client');
        await AsyncStorage.setItem('@user_data', JSON.stringify(clientProfile));
        syncUserPushToken(empClient.id, 'Client');

        return { success: true };
      }

      // 2. Prevent employees/admins from logging in here
      const { data: staffAccount } = await supabase
        .from('employees')
        .select('id, role')
        .ilike('email', trimmed)
        .maybeSingle();

      if (staffAccount && staffAccount.role !== 'Client') {
        return {
          success: false,
          error: 'This is the Client Portal. Employees and Admins must log in through Staff Login.',
        };
      }

      // 3. Fallback: check clients table by email or phone
      const { data: directClient } = await supabase
        .from('clients')
        .select('*')
        .or(`email.ilike.${trimmed},phone.ilike.${trimmed}`)
        .limit(1);

      if (directClient && directClient.length > 0) {
        const c = directClient[0];
        const clientProfile: AppUser = {
          id: c.id,
          clientId: c.id,
          name: c.name || 'Valued Client',
          email: c.email || trimmed,
          role: 'Client',
        };

        setRole('Client');
        setUser(clientProfile);
        await AsyncStorage.setItem('@user_role', 'Client');
        await AsyncStorage.setItem('@user_data', JSON.stringify(clientProfile));
        syncUserPushToken(c.id, 'Client');

        return { success: true };
      }

      return { success: false, error: 'Client account not found. Please contact Dayal office.' };
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
