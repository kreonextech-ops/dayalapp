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
  ChevronRight,
  Search,
  Phone,
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

  // Search states
  const [tableSearch, setTableSearch] = useState('');
  const [modalSearch, setModalSearch] = useState('');
  const [selectedClientRecord, setSelectedClientRecord] = useState<any>(null);
  const [showClientDropdown, setShowClientDropdown] = useState(false);

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
        supabase.from('clients').select('*').order('name', { ascending: true }),
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

  // Filter logins for main screen search
  const filteredLogins = logins.filter(login => {
    if (!tableSearch.trim()) return true;
    const term = tableSearch.toLowerCase().trim();
    const linkedClient = clients.find(c => String(c.id) === String(login.department));
    const nameMatch = (linkedClient?.name || login.name || '').toLowerCase().includes(term);
    const emailMatch = (login.email || '').toLowerCase().includes(term);
    const phoneMatch = (linkedClient?.phone || '').includes(term);
    const idMatch = `CLIENT-${login.department?.toString().substring(0, 4)}`.toLowerCase().includes(term);
    return nameMatch || emailMatch || phoneMatch || idMatch;
  });

  // Filter clients for modal search picker
  const filteredModalClients = clients.filter(c => {
    if (!modalSearch.trim()) return true;
    const term = modalSearch.toLowerCase().trim();
    return (
      (c.name || '').toLowerCase().includes(term) ||
      (c.phone || '').includes(term) ||
      (c.email || '').toLowerCase().includes(term)
    );
  });

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
        setSelectedClientRecord(null);
        setModalSearch('');
        setShowClientDropdown(false);
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
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {
            setIsModalOpen(true);
            setSelectedClientId('');
            setSelectedClientRecord(null);
            setModalSearch('');
            setShowClientDropdown(false);
          }}
        >
          <Plus size={16} color="#FFFFFF" />
          <Text style={styles.addBtnText}>New Login</Text>
        </TouchableOpacity>
      </View>

      {/* Main Search Bar */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchBox}>
          <Search size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by client, phone, or login ID..."
            placeholderTextColor={Colors.textMuted}
            value={tableSearch}
            onChangeText={setTableSearch}
            autoCapitalize="none"
          />
          {tableSearch.length > 0 && (
            <TouchableOpacity onPress={() => setTableSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading client logins...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredLogins}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => {
            const linkedClient = clients.find(c => String(c.id) === String(item.department));
            const displayName = linkedClient?.name || item.name;
            const clientCode = `CLIENT-${item.department?.toString().substring(0, 4)?.toUpperCase() || 'NEW'}`;

            return (
              <TouchableOpacity 
                style={styles.card}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('ClientHub', { clientLogin: item })}
              >
                <View style={styles.cardLeft}>
                  <View style={styles.keyCircle}>
                    <Key size={18} color={Colors.primaryDark} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.clientName}>{displayName}</Text>
                    <View style={styles.metaRow}>
                      <Mail size={12} color={Colors.textMuted} />
                      <Text style={styles.emailText}>{item.email}</Text>
                    </View>
                    {linkedClient?.phone && (
                      <View style={[styles.metaRow, { marginTop: 2 }]}>
                        <Phone size={12} color={Colors.textMuted} />
                        <Text style={styles.emailText}>{linkedClient.phone} • {clientCode}</Text>
                      </View>
                    )}
                    <View style={styles.portalBadge}>
                      <ShieldCheck size={11} color="#059669" />
                      <Text style={styles.portalBadgeText}>Client Portal • Tap to Manage</Text>
                    </View>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TouchableOpacity 
                    style={styles.deleteBtn} 
                    onPress={(e) => {
                      handleDeleteLogin(item);
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Trash2 size={18} color={Colors.danger} />
                  </TouchableOpacity>
                  <ChevronRight size={18} color={Colors.textMuted} />
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Lock size={40} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>
                {tableSearch ? `No client logins matching "${tableSearch}"` : 'No client portal logins yet'}
              </Text>
              <Text style={styles.emptySub}>
                {tableSearch ? 'Try a different client name, phone number, or login ID.' : 'Grant clients access to monitor projects & drawings.'}
              </Text>
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
              <TouchableOpacity
                onPress={() => {
                  setIsModalOpen(false);
                  setShowClientDropdown(false);
                }}
              >
                <X size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.inputLabel}>Link to Client Record *</Text>
              
              {/* Searchable Client Picker */}
              {selectedClientRecord ? (
                <View style={styles.selectedClientCard}>
                  <View style={styles.selectedClientIcon}>
                    <User size={18} color="#2563EB" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.selectedClientName}>{selectedClientRecord.name}</Text>
                    <Text style={styles.selectedClientSub}>
                      {selectedClientRecord.phone || 'No phone'}
                      {selectedClientRecord.email ? ` • ${selectedClientRecord.email}` : ''}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.clearSelectedBtn}
                    onPress={() => {
                      setSelectedClientRecord(null);
                      setSelectedClientId('');
                      setModalSearch('');
                      setShowClientDropdown(false);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <X size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.modalSearchWrapper}>
                  <View style={styles.modalSearchBox}>
                    <Search size={16} color={Colors.textMuted} />
                    <TextInput
                      style={styles.modalSearchInput}
                      placeholder="Type client name or phone to search..."
                      placeholderTextColor={Colors.textMuted}
                      value={modalSearch}
                      onChangeText={val => {
                        setModalSearch(val);
                        setShowClientDropdown(true);
                      }}
                      onFocus={() => setShowClientDropdown(true)}
                      autoCapitalize="none"
                    />
                    {modalSearch.length > 0 && (
                      <TouchableOpacity onPress={() => setModalSearch('')}>
                        <X size={14} color={Colors.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {showClientDropdown && (
                    <View style={styles.dropdownContainer}>
                      {filteredModalClients.length > 0 ? (
                        <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                          {filteredModalClients.slice(0, 15).map(c => (
                            <TouchableOpacity
                              key={c.id}
                              style={styles.dropdownItem}
                              onPress={() => {
                                setSelectedClientRecord(c);
                                setSelectedClientId(c.id);
                                const defaultUsername = c.phone || c.email?.split('@')[0] || c.name.toLowerCase().replace(/\s+/g, '');
                                if (!loginEmail) {
                                  setLoginEmail(defaultUsername);
                                }
                                setShowClientDropdown(false);
                                setModalSearch('');
                              }}
                            >
                              <Text style={styles.dropdownClientName}>{c.name}</Text>
                              <Text style={styles.dropdownClientSub}>
                                {c.phone || 'No phone'}{c.email ? ` • ${c.email}` : ''}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      ) : (
                        <View style={styles.dropdownEmpty}>
                          <Text style={styles.dropdownEmptyText}>
                            No clients matching "{modalSearch}"
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}

              <Text style={[styles.inputLabel, { marginTop: 14 }]}>Portal Login ID (Username / Email / Phone) *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. client phone or email"
                placeholderTextColor={Colors.textMuted}
                value={loginEmail}
                onChangeText={setLoginEmail}
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>Portal Login Password *</Text>
              <TextInput
                style={styles.input}
                placeholder="Temporary Password"
                placeholderTextColor={Colors.textMuted}
                value={loginPassword}
                onChangeText={setLoginPassword}
                secureTextEntry
              />

              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    setIsModalOpen(false);
                    setShowClientDropdown(false);
                  }}
                >
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
  searchBarContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
    paddingVertical: 4,
  },
  selectedClientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
  },
  selectedClientIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedClientName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  selectedClientSub: {
    fontSize: 11,
    color: '#3B82F6',
    marginTop: 1,
  },
  clearSelectedBtn: {
    padding: 6,
  },
  modalSearchWrapper: {
    marginTop: 4,
    position: 'relative',
    zIndex: 10,
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    gap: 8,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
    paddingVertical: 4,
  },
  dropdownContainer: {
    marginTop: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    maxHeight: 180,
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownClientName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  dropdownClientSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  dropdownEmpty: {
    padding: 12,
    alignItems: 'center',
  },
  dropdownEmptyText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: Colors.primaryDark,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveText: { color: '#FFFFFF', fontWeight: 'bold' },
});
