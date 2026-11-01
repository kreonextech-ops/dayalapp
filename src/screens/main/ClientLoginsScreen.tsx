import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  FlatList,
  TextInput,
  Modal,
  Alert,
  Platform,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Key,
  Plus,
  Trash2,
  Lock,
  User,
  Mail,
  X,
  ShieldCheck,
} from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function ClientLoginsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 20);
  const { isAdmin } = useAuth();

  const [logins, setLogins] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // New Client Login Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [clientsRes, loginsRes] = await Promise.all([
        supabase.from('clients').select('id, name').order('name', { ascending: true }),
        supabase
          .from('employees')
          .select('*')
          .eq('role', 'Client')
          .order('created_at', { ascending: false }),
      ]);

      if (clientsRes.data) setClients(clientsRes.data);
      if (loginsRes.data) setLogins(loginsRes.data);
    } catch (e: any) {
      console.warn('Client logins fetch error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleCreateLogin = async () => {
    if (!selectedClientId) {
      Alert.alert('Required', 'Please select a client.');
      return;
    }
    if (!loginEmail.trim() || !loginPassword.trim()) {
      Alert.alert('Required', 'Please enter email and password.');
      return;
    }

    setIsSaving(true);
    try {
      const selectedClient = clients.find(c => String(c.id) === String(selectedClientId));
      const payload = {
        name: selectedClient?.name || 'Client Portal',
        email: loginEmail.trim().toLowerCase(),
        password: loginPassword.trim(),
        role: 'Client',
        department: selectedClientId, // Stores client id to link with client account
      };

      const { data, error } = await supabase.from('employees').insert([payload]).select();
      if (error) {
        if (error.message.includes('duplicate')) {
          throw new Error('This email already has a portal login.');
        }
        throw error;
      }

      if (data) {
        setLogins(prev => [data[0], ...prev]);
        setIsModalOpen(false);
        setSelectedClientId('');
        setLoginEmail('');
        setLoginPassword('');
        Alert.alert('Success', 'Client portal credentials generated.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create login');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLogin = (login: any) => {
    Alert.alert(
      'Revoke Access',
      `Revoke portal access for ${login.name} (${login.email})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('employees').delete().eq('id', login.id);
              if (error) throw error;
              setLogins(prev => prev.filter(l => l.id !== login.id));
              Alert.alert('Revoked', 'Portal credentials removed.');
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to delete');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: safeTop }]}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.topBarTitle}>Client Portal Logins</Text>
          <Text style={styles.topBarSub}>Manage client credentials & portal access</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setIsModalOpen(true)}>
          <Plus size={16} color="#FFFFFF" />
          <Text style={styles.addBtnText}>New Login</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading client logins...</Text>
        </View>
      ) : (
        <FlatList
          data={logins}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardLeft}>
                <View style={styles.keyCircle}>
                  <Key size={18} color={Colors.primaryDark} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.clientName}>{item.name}</Text>
                  <View style={styles.metaRow}>
                    <Mail size={12} color={Colors.textMuted} />
                    <Text style={styles.emailText}>{item.email}</Text>
                  </View>
                  <View style={styles.portalBadge}>
                    <ShieldCheck size={11} color="#059669" />
                    <Text style={styles.portalBadgeText}>Client Portal Active</Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteLogin(item)}>
                <Trash2 size={18} color={Colors.danger} />
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Lock size={40} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No client portal logins yet</Text>
              <Text style={styles.emptySub}>Grant clients access to monitor projects & drawings.</Text>
            </View>
          }
        />
      )}

      {/* New Login Modal */}
      <Modal visible={isModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Issue Client Portal Login</Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <X size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Select Client *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                {clients.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      styles.clientChip,
                      selectedClientId === c.id && styles.clientChipActive,
                    ]}
                    onPress={() => setSelectedClientId(c.id)}
                  >
                    <Text
                      style={[
                        styles.clientChipText,
                        selectedClientId === c.id && styles.clientChipTextActive,
                      ]}
                    >
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.inputLabel}>Portal Login Email *</Text>
              <TextInput
                style={styles.input}
                placeholder="client@gmail.com"
                value={loginEmail}
                onChangeText={setLoginEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>Portal Login Password *</Text>
              <TextInput
                style={styles.input}
                placeholder="Temporary Password"
                value={loginPassword}
                onChangeText={setLoginPassword}
                secureTextEntry
              />

              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsModalOpen(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, isSaving && { opacity: 0.6 }]}
                  onPress={handleCreateLogin}
                  disabled={isSaving}
                >
                  <Text style={styles.saveText}>{isSaving ? 'Creating...' : 'Grant Access'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: Colors.textMuted },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { padding: 4 },
  topBarTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  topBarSub: { fontSize: 11, color: Colors.textMuted },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  addBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  listContent: { padding: 16, paddingBottom: 60 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  keyCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clientName: { fontSize: 14, fontWeight: 'bold', color: Colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  emailText: { fontSize: 12, color: Colors.textMuted },
  portalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
    gap: 4,
  },
  portalBadgeText: { fontSize: 10, color: '#059669', fontWeight: '700' },
  deleteBtn: { padding: 8 },
  empty: { alignItems: 'center', marginTop: 40 },
  emptyTitle: { fontSize: 14, fontWeight: 'bold', color: Colors.text, marginTop: 10 },
  emptySub: { fontSize: 12, color: Colors.textMuted, marginTop: 4, textAlign: 'center', maxWidth: 260 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: Colors.text },
  inputLabel: { fontSize: 12, fontWeight: '600', color: Colors.text, marginTop: 10, marginBottom: 4 },
  clientChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8,
  },
  clientChipActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primaryDark,
  },
  clientChipText: { fontSize: 12, color: Colors.text },
  clientChipTextActive: { color: Colors.primaryDark, fontWeight: 'bold' },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: Colors.text,
  },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 20, marginBottom: 20 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelText: { color: Colors.text, fontWeight: '600' },
  saveBtn: {
    flex: 1,
    backgroundColor: Colors.primaryDark,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveText: { color: '#FFFFFF', fontWeight: 'bold' },
});
