import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  StatusBar,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronRight,
  LogOut,
  Shield,
  Bell,
  Settings,
  HelpCircle,
  Info,
  User,
  IndianRupee,
  Layers,
  Clock,
  Briefcase,
  Key,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  X,
  ShieldCheck,
} from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

export default function ProfileScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 20);
  const { user, role, isAdmin, signOut } = useAuth();

  // Security Credentials Modal
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // About Modal
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigation.reset({
      index: 0,
      routes: [{ name: 'LoginSelection' }],
    });
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword.trim()) {
      Alert.alert('Required', 'Please enter your current password.');
      return;
    }
    if (!newPassword.trim()) {
      Alert.alert('Required', 'Please enter a new password.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Too Short', 'New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'New password and confirm password do not match.');
      return;
    }

    setIsUpdating(true);
    try {
      const userEmail = user?.email?.trim().toLowerCase();
      const userId = user?.id;

      // 1. Fetch user from employees table by id or email
      let query = supabase.from('employees').select('id, name, email, password');
      if (userId) {
        query = query.eq('id', userId);
      } else if (userEmail) {
        query = query.eq('email', userEmail);
      }

      const { data: dbUser, error: fetchErr } = await query.single();

      if (fetchErr || !dbUser) {
        throw new Error('Could not verify account identity in database.');
      }

      // 2. Verify current password
      if (dbUser.password && dbUser.password !== currentPassword) {
        Alert.alert('Authentication Failed', 'The current password you entered is incorrect. Please try again.');
        setIsUpdating(false);
        return;
      }

      // 3. Update password in Supabase
      const { error: updateErr } = await supabase
        .from('employees')
        .update({ password: newPassword })
        .eq('id', dbUser.id);

      if (updateErr) throw updateErr;

      // 4. Log to audit_logs
      try {
        await supabase.from('audit_logs').insert([
          {
            module: 'Security',
            action_type: 'UPDATE',
            employee_name: user?.name || 'Staff',
            description: `Password updated for account: ${dbUser.name || userEmail}`,
          },
        ]);
      } catch {
        // Non-blocking audit log
      }

      Alert.alert(
        'Success',
        'Your security password and account credentials have been updated successfully.',
        [{ text: 'OK', onPress: () => setIsSecurityModalOpen(false) }]
      );

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update password');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: safeTop }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Account & Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Banner */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{isAdmin ? 'AD' : role === 'CRO' ? 'CR' : 'ST'}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.nameText}>{user?.name || (isAdmin ? 'Admin' : 'Staff Member')}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>
                {isAdmin ? 'System Administrator' : `${role || 'Staff'} Member`}
              </Text>
            </View>
            <Text style={styles.companyText}>{user?.email || 'Dayal Constructions & Co.'}</Text>
          </View>
        </View>

        {/* Quick Access Modules */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>CRM Navigation Modules</Text>
          <SettingRow
            icon={<Layers color="#2563EB" size={20} />}
            title="Consultancy Services"
            subtitle="2D/3D Drawings, Planning & Sanctions"
            onPress={() => navigation.navigate('ServicesList')}
          />
          <SettingRow
            icon={<Clock color="#D97706" size={20} />}
            title="Follow-Ups Center"
            subtitle="View & schedule reminder calls"
            onPress={() => navigation.navigate('FollowUps')}
          />
          <SettingRow
            icon={<Briefcase color="#7C3AED" size={20} />}
            title="Tasks & Assignments"
            subtitle="Checklists, work items & operations"
            onPress={() => navigation.navigate('Tasks')}
          />
          {isAdmin && (
            <SettingRow
              icon={<IndianRupee color="#059669" size={20} />}
              title="Financials & Revenue"
              subtitle="Cashflow, contract billing & ledger"
              onPress={() => navigation.navigate('Finance')}
            />
          )}
        </View>

        {/* Preferences & Security */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Preferences & Security</Text>
          <SettingRow
            icon={<Bell color={Colors.primaryDark} size={20} />}
            title="Notifications Feed"
            subtitle="View company alerts"
            onPress={() => navigation.navigate('Notifications')}
          />
          <SettingRow
            icon={<Shield color={Colors.primaryDark} size={20} />}
            title="Security"
            subtitle="Account credentials"
            onPress={() => setIsSecurityModalOpen(true)}
          />
          <SettingRow
            icon={<Info color={Colors.primaryDark} size={20} />}
            title="About Dayal CRM"
            subtitle="Version 1.0.0 (Production Ready)"
            onPress={() => setIsAboutModalOpen(true)}
          />
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
          <LogOut color={Colors.danger} size={20} style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ===================== SECURITY & CREDENTIALS MODAL ===================== */}
      <Modal visible={isSecurityModalOpen} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={styles.shieldIconBox}>
                  <ShieldCheck size={20} color="#2563EB" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Security & Credentials</Text>
                  <Text style={styles.modalSub}>Manage your account password</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setIsSecurityModalOpen(false)} style={styles.closeBtn}>
                <X size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* Identity Card */}
              <View style={styles.identityCard}>
                <View style={styles.identityRow}>
                  <Text style={styles.identityLabel}>Account User</Text>
                  <Text style={styles.identityVal}>{user?.name || 'Administrator'}</Text>
                </View>
                <View style={styles.identityRow}>
                  <Text style={styles.identityLabel}>Login Email</Text>
                  <Text style={styles.identityVal}>{user?.email || 'N/A'}</Text>
                </View>
                <View style={[styles.identityRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.identityLabel}>Access Role</Text>
                  <Text style={[styles.identityVal, { color: Colors.primaryDark, fontWeight: '700' }]}>
                    {isAdmin ? 'System Administrator' : `${role || 'Staff'} Access`}
                  </Text>
                </View>
              </View>

              <Text style={styles.sectionSubHeading}>Change Password</Text>

              {/* Current Password */}
              <Text style={styles.inputLabel}>Current Password *</Text>
              <View style={styles.passwordInputWrap}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry={!showCurrentPw}
                  placeholderTextColor={Colors.textMuted}
                />
                <TouchableOpacity onPress={() => setShowCurrentPw(!showCurrentPw)} style={styles.eyeBtn}>
                  {showCurrentPw ? <EyeOff size={18} color={Colors.textMuted} /> : <Eye size={18} color={Colors.textMuted} />}
                </TouchableOpacity>
              </View>

              {/* New Password */}
              <Text style={styles.inputLabel}>New Password *</Text>
              <View style={styles.passwordInputWrap}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Enter at least 6 characters"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showNewPw}
                  placeholderTextColor={Colors.textMuted}
                />
                <TouchableOpacity onPress={() => setShowNewPw(!showNewPw)} style={styles.eyeBtn}>
                  {showNewPw ? <EyeOff size={18} color={Colors.textMuted} /> : <Eye size={18} color={Colors.textMuted} />}
                </TouchableOpacity>
              </View>

              {/* Confirm Password */}
              <Text style={styles.inputLabel}>Confirm New Password *</Text>
              <View style={styles.passwordInputWrap}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Re-type new password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPw}
                  placeholderTextColor={Colors.textMuted}
                />
                <TouchableOpacity onPress={() => setShowConfirmPw(!showConfirmPw)} style={styles.eyeBtn}>
                  {showConfirmPw ? <EyeOff size={18} color={Colors.textMuted} /> : <Eye size={18} color={Colors.textMuted} />}
                </TouchableOpacity>
              </View>

              {/* Security Info */}
              <View style={styles.secNoticeBox}>
                <Lock size={14} color="#059669" />
                <Text style={styles.secNoticeText}>
                  Sessions are protected with Supabase Row-Level Security (RLS) & encrypted tokens.
                </Text>
              </View>

              {/* Save Button */}
              <TouchableOpacity
                style={[styles.savePwBtn, isUpdating && { opacity: 0.7 }]}
                onPress={handleUpdatePassword}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.savePwBtnText}>Update Credentials</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ===================== ABOUT APP MODAL ===================== */}
      <Modal visible={isAboutModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: '60%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.shieldIconBox, { backgroundColor: '#F0FDF4' }]}>
                  <Info size={20} color="#059669" />
                </View>
                <Text style={styles.modalTitle}>About Dayal CRM</Text>
              </View>
              <TouchableOpacity onPress={() => setIsAboutModalOpen(false)} style={styles.closeBtn}>
                <X size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: Colors.text, marginBottom: 4 }}>
                Dayal Constructions & Consultants
              </Text>
              <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 12 }}>
                Enterprise Mobile Field & Office CRM Suite
              </Text>
              <View style={styles.identityCard}>
                <View style={styles.identityRow}>
                  <Text style={styles.identityLabel}>Application Version</Text>
                  <Text style={styles.identityVal}>1.0.0 Production</Text>
                </View>
                <View style={styles.identityRow}>
                  <Text style={styles.identityLabel}>Backend Infrastructure</Text>
                  <Text style={styles.identityVal}>Supabase Cloud DB</Text>
                </View>
                <View style={[styles.identityRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.identityLabel}>Realtime Alerts</Text>
                  <Text style={[styles.identityVal, { color: Colors.success, fontWeight: 'bold' }]}>Active</Text>
                </View>
              </View>
              <Text style={{ fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginTop: 14 }}>
                © 2026 Dayal Construction & Consultant Co. All rights reserved.
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const SettingRow = ({ icon, title, subtitle, onPress }: any) => (
  <TouchableOpacity style={styles.settingRow} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
    <View style={styles.settingIconContainer}>{icon}</View>
    <View style={styles.settingTextContainer}>
      <Text style={styles.settingTitle}>{title}</Text>
      <Text style={styles.settingSubtitle}>{subtitle}</Text>
    </View>
    <ChevronRight color={Colors.textMuted} size={18} />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text },
  scrollContent: { padding: 16, paddingBottom: 40, gap: 16 },
  profileCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primaryDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: 'bold', color: '#FFFFFF' },
  profileInfo: { flex: 1 },
  nameText: { fontSize: 17, fontWeight: 'bold', color: Colors.text },
  roleBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 3,
  },
  roleText: { fontSize: 11, fontWeight: '600', color: '#92400E' },
  companyText: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionHeader: { fontSize: 13, fontWeight: '700', color: Colors.textMuted, marginBottom: 10 },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingTextContainer: { flex: 1 },
  settingTitle: { fontSize: 14, fontWeight: '600', color: Colors.text },
  settingSubtitle: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    paddingVertical: 14,
    borderRadius: 12,
  },
  logoutText: { fontSize: 15, fontWeight: 'bold', color: Colors.danger },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  shieldIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  modalSub: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  closeBtn: {
    padding: 4,
  },
  identityCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  identityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  identityLabel: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  identityVal: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  sectionSubHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 8,
  },
  passwordInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
  },
  eyeBtn: {
    padding: 6,
  },
  secNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 8,
    padding: 10,
    marginTop: 16,
  },
  secNoticeText: {
    fontSize: 11,
    color: '#065F46',
    flex: 1,
    lineHeight: 15,
  },
  savePwBtn: {
    backgroundColor: Colors.primaryDark,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 18,
  },
  savePwBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
