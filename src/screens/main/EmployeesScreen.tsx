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
  Linking,
  Modal,
  Alert,
  Platform,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Search,
  Plus,
  Phone,
  Mail,
  Shield,
  Briefcase,
  Building,
  User,
  X,
  ChevronRight,
} from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function EmployeesScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 20);
  const { isAdmin, isClient } = useAuth();

  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('All');

  // New Employee Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState('Sales');
  const [role, setRole] = useState('Employee');

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setEmployees(data || []);
    } catch (e: any) {
      console.warn('Employees fetch error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchEmployees();
  };

  const handleCreateEmployee = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter employee name.');
      return;
    }

    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        designation: designation.trim() || 'Staff',
        department: department.trim(),
        role: role.trim(),
      };

      const { data, error } = await supabase.from('employees').insert([payload]).select();
      if (error) throw error;

      if (data) {
        setEmployees(prev => [...prev, data[0]]);
        setIsAddModalOpen(false);
        setName('');
        setPhone('');
        setEmail('');
        setDesignation('');
        Alert.alert('Success', 'Team member added.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to add employee');
    }
  };

  const filtered = employees.filter(e => {
    const q = searchTerm.toLowerCase();
    const matchSearch =
      (e.name && e.name.toLowerCase().includes(q)) ||
      (e.designation && e.designation.toLowerCase().includes(q)) ||
      (e.department && e.department.toLowerCase().includes(q)) ||
      (e.phone && e.phone.includes(q));

    const matchRole =
      selectedRole === 'All' ? true : selectedRole === 'Admin' ? e.role === 'Admin' : e.role !== 'Admin';

    return matchSearch && matchRole;
  });

  if (!isAdmin) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: safeTop, paddingHorizontal: 24 }]}>
        <Shield size={48} color={Colors.danger} />
        <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.text, marginTop: 16 }}>Access Restricted</Text>
        <Text style={{ fontSize: 13, color: Colors.textMuted, marginTop: 6, textAlign: 'center', lineHeight: 20 }}>
          Employee Directory and staff management are strictly reserved for System Administrators.
        </Text>
        <TouchableOpacity
          style={{ marginTop: 24, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: Colors.primary, borderRadius: 10 }}
          onPress={() => navigation.goBack()}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: safeTop }]}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.topBarTitle}>Employees & Staff</Text>
          <Text style={styles.topBarSub}>Dayal Constructions Team Directory</Text>
        </View>
        {isAdmin && (
          <TouchableOpacity style={styles.addBtn} onPress={() => setIsAddModalOpen(true)}>
            <Plus size={16} color="#FFFFFF" />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Search & Filter Bar */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchBox}>
          <Search size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search team member..."
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholderTextColor={Colors.textMuted}
          />
        </View>
      </View>

      {/* Role Filter Tabs */}
      <View style={styles.filterRow}>
        {(['All', 'Admin', 'Staff'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterPill, selectedRole === tab && styles.filterPillActive]}
            onPress={() => setSelectedRole(tab)}
          >
            <Text style={[styles.filterPillText, selectedRole === tab && styles.filterPillTextActive]}>
              {tab === 'All' ? 'All Members' : tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading directory...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id?.toString() || Math.random().toString()}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              {/* Tappable Header & Info Section */}
              <TouchableOpacity
                style={styles.cardHeaderTouchable}
                activeOpacity={0.6}
                onPress={() => {
                  navigation.navigate('EmployeeDetails', { id: item.id, employee: item });
                }}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{item.name?.charAt(0).toUpperCase() || 'E'}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                      <Text style={styles.empName}>{item.name}</Text>
                      {item.role === 'Admin' ? (
                        <View style={styles.adminBadge}>
                          <Shield size={10} color="#B45309" />
                          <Text style={styles.adminBadgeText}>Admin</Text>
                        </View>
                      ) : item.role === 'CRO' ? (
                        <View style={[styles.adminBadge, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                          <Text style={[styles.adminBadgeText, { color: '#2563EB' }]}>CRO</Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.chevronBox}>
                      <ChevronRight size={18} color={Colors.primaryDark} />
                    </View>
                  </View>
                  <Text style={styles.empDesig}>{item.designation || 'Staff'}</Text>
                  {item.department ? (
                    <Text style={styles.empDept}>{item.department}</Text>
                  ) : null}
                </View>
              </TouchableOpacity>

              {/* Action Footer */}
              <View style={styles.cardFooter}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  {item.phone ? (
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => Linking.openURL(`tel:${item.phone}`)}
                    >
                      <Phone size={13} color={Colors.primaryDark} />
                      <Text style={styles.actionBtnText}>{item.phone}</Text>
                    </TouchableOpacity>
                  ) : null}
                  {item.email ? (
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => Linking.openURL(`mailto:${item.email}`)}
                    >
                      <Mail size={13} color={Colors.textMuted} />
                      <Text style={[styles.actionBtnText, { color: Colors.textMuted }]} numberOfLines={1}>
                        {item.email}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                <TouchableOpacity
                  style={styles.viewProfileBtn}
                  onPress={() => navigation.navigate('EmployeeDetails', { id: item.id, employee: item })}
                >
                  <Text style={styles.viewProfileText}>View Profile →</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <User size={40} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No team members found</Text>
            </View>
          }
        />
      )}

      {/* Add Employee Modal */}
      <Modal visible={isAddModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Team Member</Text>
              <TouchableOpacity onPress={() => setIsAddModalOpen(false)}>
                <X size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Full Name *</Text>
              <TextInput style={styles.input} placeholder="e.g. Rahul Sharma" value={name} onChangeText={setName} />

              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput style={styles.input} placeholder="+91 98765 43210" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />

              <Text style={styles.inputLabel}>Email Address</Text>
              <TextInput style={styles.input} placeholder="rahul@dayalconstructions.com" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />

              <Text style={styles.inputLabel}>Designation / Title</Text>
              <TextInput style={styles.input} placeholder="e.g. Senior Architect" value={designation} onChangeText={setDesignation} />

              <Text style={styles.inputLabel}>Department</Text>
              <TextInput style={styles.input} placeholder="e.g. Planning, Sales, Engineering" value={department} onChangeText={setDepartment} />

              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsAddModalOpen(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleCreateEmployee}>
                  <Text style={styles.saveText}>Save Member</Text>
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
  searchWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 13, color: Colors.text },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterPillActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primaryDark,
  },
  filterPillText: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  filterPillTextActive: { color: Colors.primaryDark },
  listContent: { padding: 16, paddingBottom: 60 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeaderTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 4,
  },
  chevronBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewProfileBtn: {
    marginLeft: 'auto',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
  },
  viewProfileText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: 'bold', color: Colors.primaryDark },
  empName: { fontSize: 14, fontWeight: 'bold', color: Colors.text },
  empDesig: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  empDept: { fontSize: 11, color: Colors.primary, fontWeight: '600', marginTop: 1 },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
  },
  adminBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#B45309' },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 16,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionBtnText: { fontSize: 12, color: Colors.primaryDark, fontWeight: '600' },
  empty: { alignItems: 'center', marginTop: 40 },
  emptyTitle: { fontSize: 14, color: Colors.textMuted, marginTop: 8 },
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
