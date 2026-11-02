import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  StatusBar,
  Linking,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  User,
  Phone,
  Mail,
  ShieldCheck,
  FileText,
  LogOut,
  ChevronRight,
  ExternalLink,
  MessageCircle,
  Building,
  Sparkles,
} from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

export default function ClientProfileScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 20);
  const { user, signOut } = useAuth();
  const clientId = user?.clientId || user?.id;

  const [clientData, setClientData] = useState<any>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!clientId) return;
      const { data } = await supabase.from('clients').select('*').eq('id', clientId).maybeSingle();
      if (data) setClientData(data);
    };
    fetchProfile();
  }, [clientId]);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to log out of your client portal?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          navigation.reset({ index: 0, routes: [{ name: 'LoginSelection' }] });
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: safeTop }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Account & Support</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {(clientData?.name || user?.name || 'C').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.clientName}>{clientData?.name || user?.name || 'Valued Client'}</Text>
          <View style={styles.portalTag}>
            <ShieldCheck size={12} color="#059669" />
            <Text style={styles.portalTagText}>Authorized Client Portal</Text>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.infoList}>
            {clientData?.phone && (
              <View style={styles.infoRow}>
                <Phone size={14} color={Colors.textMuted} />
                <Text style={styles.infoText}>{clientData.phone}</Text>
              </View>
            )}
            <View style={styles.infoRow}>
              <Mail size={14} color={Colors.textMuted} />
              <Text style={styles.infoText}>{clientData?.email || user?.email}</Text>
            </View>
            {clientData?.address && (
              <View style={styles.infoRow}>
                <Building size={14} color={Colors.textMuted} />
                <Text style={styles.infoText}>{clientData.address}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Dayal Support Quick Actions */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>Direct Support & Office</Text>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => Linking.openURL('tel:+919876543210')}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconBox, { backgroundColor: '#EFF6FF' }]}>
              <Phone size={18} color="#2563EB" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Call Project Office</Text>
              <Text style={styles.actionSubtitle}>Speak with your project engineer</Text>
            </View>
            <ChevronRight size={18} color={Colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => Linking.openURL('https://wa.me/919876543210')}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconBox, { backgroundColor: '#F0FDF4' }]}>
              <MessageCircle size={18} color="#16A34A" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>WhatsApp Support</Text>
              <Text style={styles.actionSubtitle}>Instant queries & file sharing</Text>
            </View>
            <ChevronRight size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Legal & Compliance */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>Legal & Privacy</Text>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => Linking.openURL('https://dayalconstructions.com/privacy-policy')}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconBox, { backgroundColor: '#F8FAFC' }]}>
              <FileText size={18} color={Colors.primaryDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Privacy Policy</Text>
              <Text style={styles.actionSubtitle}>dayalconstructions.com/privacy-policy</Text>
            </View>
            <ExternalLink size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <LogOut size={18} color={Colors.danger} style={{ marginRight: 8 }} />
          <Text style={styles.logoutBtnText}>Sign Out from Portal</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  profileCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1E3A8A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatarText: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  clientName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  portalTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginTop: 6,
  },
  portalTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },
  infoDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    width: '100%',
    marginVertical: 16,
  },
  infoList: {
    width: '100%',
    gap: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoText: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '500',
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeader: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
    gap: 12,
  },
  actionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: Colors.text,
  },
  actionSubtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginTop: 8,
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.danger,
  },
});
