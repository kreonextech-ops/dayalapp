import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  FlatList,
  Linking,
  TextInput,
  Platform,
  StatusBar,
  RefreshControl,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Plus,
  Search,
  Phone,
  MapPin,
  ChevronRight,
  Flame,
  Sun,
  Snowflake,
  User,
  Filter,
  UserCheck,
  Briefcase,
  Layers,
  ArrowUpDown,
  X,
  Check,
} from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const STATUS_FILTERS = ['All', 'New', 'Ongoing', 'Success', 'Closed'];
const TEMP_FILTERS = ['All', 'Hot', 'Warm', 'Cold'];
const COMMON_SERVICES = [
  'All Services',
  'Building Plan Approval',
  '2D Floor Plan Design',
  '3D Floor Plan Design',
  '3D Elevation Design',
  'Soil Testing',
  'Structural Design',
  'Land Registration',
  'Mutation / Conversion',
  'Interior Design',
  'Construction',
];

export default function LeadsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 20);

  const [leads, setLeads] = useState<any[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [employeesMap, setEmployeesMap] = useState<Record<string, string>>({});

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [tempFilter, setTempFilter] = useState('All');
  const [employeeFilter, setEmployeeFilter] = useState('All'); // 'All' | 'My Leads' | 'Unassigned' | employee_id
  const [serviceFilter, setServiceFilter] = useState('All Services');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'name'>('newest');

  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { role, user, isAdmin } = useAuth();

  useEffect(() => {
    fetchLeadsAndEmployees();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchTerm, statusFilter, tempFilter, employeeFilter, serviceFilter, sortOrder, leads]);

  const fetchLeadsAndEmployees = async () => {
    setLoading(true);
    try {
      // In web CRM: All leads are visible to all staff, with filters by employee/status/etc.
      const [leadsRes, empRes] = await Promise.all([
        supabase.from('leads').select('*').order('created_at', { ascending: false }),
        supabase.from('employees').select('id, name, designation, role').order('name'),
      ]);

      if (leadsRes.error) throw leadsRes.error;

      const emps = empRes.data || [];
      setEmployees(emps);

      const map: Record<string, string> = {};
      emps.forEach(e => {
        map[e.id] = e.name;
        map[e.name] = e.name;
      });
      setEmployeesMap(map);

      setLeads(leadsRes.data || []);
    } catch (error: any) {
      console.error('Leads fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applyFilters = () => {
    let result = [...leads];

    // Status Filter
    if (statusFilter !== 'All') {
      result = result.filter(
        l => (l.status || 'New').toLowerCase() === statusFilter.toLowerCase()
      );
    }

    // Temperature Filter
    if (tempFilter !== 'All') {
      result = result.filter(
        l => (l.lead_temperature || 'Warm').toLowerCase() === tempFilter.toLowerCase()
      );
    }

    // Employee Assigned Filter
    if (employeeFilter === 'My Leads') {
      const myId = user?.id;
      const myName = user?.name?.toLowerCase();
      result = result.filter(l => {
        if (!l.assigned_to) return false;
        if (myId && l.assigned_to === myId) return true;
        if (myName && l.assigned_to.toLowerCase().includes(myName)) return true;
        return false;
      });
    } else if (employeeFilter === 'Unassigned') {
      result = result.filter(l => !l.assigned_to || l.assigned_to.trim() === '');
    } else if (employeeFilter !== 'All') {
      // Specific employee id selected
      const selectedEmp = employees.find(e => e.id === employeeFilter);
      const empName = selectedEmp?.name?.toLowerCase();
      result = result.filter(l => {
        if (!l.assigned_to) return false;
        if (l.assigned_to === employeeFilter) return true;
        if (empName && l.assigned_to.toLowerCase().includes(empName)) return true;
        return false;
      });
    }

    // Service Filter
    if (serviceFilter !== 'All Services') {
      result = result.filter(l =>
        l.service_type?.toLowerCase().includes(serviceFilter.toLowerCase())
      );
    }

    // Search Query
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        l =>
          l.name?.toLowerCase().includes(q) ||
          l.phone?.includes(q) ||
          l.address?.toLowerCase().includes(q) ||
          l.service_type?.toLowerCase().includes(q) ||
          (l.assigned_to && l.assigned_to.toLowerCase().includes(q))
      );
    }

    // Sorting
    if (sortOrder === 'newest') {
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sortOrder === 'oldest') {
      result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else if (sortOrder === 'name') {
      result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    setFilteredLeads(result);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeadsAndEmployees();
  };

  const handleCall = (phone: string, e: any) => {
    e.stopPropagation();
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  const getStatusStyle = (status: string) => {
    switch ((status || 'New').toLowerCase()) {
      case 'success':
      case 'won':
        return { color: '#16A34A', bg: '#DCFCE7' };
      case 'closed':
      case 'lost':
        return { color: '#DC2626', bg: '#FEE2E2' };
      case 'ongoing':
      case 'contacted':
        return { color: '#D97706', bg: '#FFFBEB' };
      default:
        return { color: '#2563EB', bg: '#EFF6FF' };
    }
  };

  const getTempStyle = (temp: string) => {
    switch ((temp || 'Warm').toLowerCase()) {
      case 'hot':
        return { icon: '🔥', label: 'HOT', color: '#DC2626', bg: '#FEE2E2' };
      case 'cold':
        return { icon: '❄️', label: 'COLD', color: '#2563EB', bg: '#EFF6FF' };
      default:
        return { icon: '☀️', label: 'WARM', color: '#D97706', bg: '#FFFBEB' };
    }
  };

  const renderLeadCard = ({ item }: { item: any }) => {
    const statusStyle = getStatusStyle(item.status);
    const tempStyle = getTempStyle(item.lead_temperature);
    const assignedStaffName = employeesMap[item.assigned_to] || item.assigned_to;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('LeadDetails', { id: item.id })}
      >
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.name}</Text>
            {item.phone && <Text style={styles.phone}>{item.phone}</Text>}
            {item.address && (
              <View style={styles.addressRow}>
                <MapPin size={11} color={Colors.textMuted} />
                <Text style={styles.addressText} numberOfLines={1}>
                  {item.address}
                </Text>
              </View>
            )}
            {item.service_type && (
              <Text style={styles.serviceText} numberOfLines={1}>
                {item.service_type}
              </Text>
            )}
          </View>

          {/* Dual Status & Temperature Badges */}
          <View style={styles.rightCol}>
            <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
              <Text style={[styles.statusBadgeText, { color: statusStyle.color }]}>
                {item.status || 'New'}
              </Text>
            </View>

            <View style={[styles.tempBadge, { backgroundColor: tempStyle.bg }]}>
              <Text style={styles.tempIcon}>{tempStyle.icon}</Text>
              <Text style={[styles.tempText, { color: tempStyle.color }]}>{tempStyle.label}</Text>
            </View>
          </View>
        </View>

        <View style={styles.cardFooter}>
          {/* Assigned Staff Badge */}
          <View style={styles.assignedBadge}>
            <UserCheck size={11} color={assignedStaffName ? Colors.primaryDark : Colors.textMuted} />
            <Text style={[styles.assignedText, assignedStaffName && { color: Colors.primaryDark, fontWeight: '700' }]} numberOfLines={1}>
              {assignedStaffName || 'Unassigned'}
            </Text>
          </View>

          <View style={styles.sourceTag}>
            <Text style={styles.sourceText}>{item.source || 'Direct'}</Text>
          </View>

          <Text style={styles.dateText}>
            {new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </Text>

          <View style={{ flex: 1 }} />

          <TouchableOpacity
            style={styles.callCircle}
            onPress={(e) => handleCall(item.phone, e)}
          >
            <Phone color={Colors.success} size={14} />
          </TouchableOpacity>
          <ChevronRight size={16} color={Colors.textMuted} style={{ marginLeft: 6 }} />
        </View>
      </TouchableOpacity>
    );
  };

  const activeFiltersCount =
    (statusFilter !== 'All' ? 1 : 0) +
    (tempFilter !== 'All' ? 1 : 0) +
    (employeeFilter !== 'All' ? 1 : 0) +
    (serviceFilter !== 'All Services' ? 1 : 0);

  return (
    <View style={[styles.container, { paddingTop: safeTop }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Leads Pipeline</Text>
          <Text style={styles.headerSubtitle}>
            {filteredLeads.length} of {leads.length} leads matching filters
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={[styles.filterBtn, activeFiltersCount > 0 && styles.filterBtnActive]}
            onPress={() => setIsFilterModalOpen(true)}
          >
            <Filter size={16} color={activeFiltersCount > 0 ? '#FFFFFF' : Colors.text} />
            {activeFiltersCount > 0 && (
              <View style={styles.filterCountBadge}>
                <Text style={styles.filterCountText}>{activeFiltersCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => navigation.navigate('NewLead')}
          >
            <Plus size={16} color="#FFFFFF" />
            <Text style={styles.addBtnText}>New</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Input */}
      <View style={styles.searchBox}>
        <Search size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, phone, address, services, staff..."
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholderTextColor={Colors.textMuted}
        />
        {searchTerm.length > 0 && (
          <TouchableOpacity onPress={() => setSearchTerm('')}>
            <X size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Row 1: Employee Assigned Filter Chips */}
      <View style={styles.filterSectionRow}>
        <Text style={styles.filterLabel}>Assigned Staff:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipScroll}>
          <TouchableOpacity
            style={[styles.empChip, employeeFilter === 'All' && styles.empChipActive]}
            onPress={() => setEmployeeFilter('All')}
          >
            <Text style={[styles.empChipText, employeeFilter === 'All' && styles.empChipTextActive]}>
              All Staff
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.empChip, employeeFilter === 'My Leads' && styles.empChipActive]}
            onPress={() => setEmployeeFilter('My Leads')}
          >
            <Text style={[styles.empChipText, employeeFilter === 'My Leads' && styles.empChipTextActive]}>
              👤 My Leads
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.empChip, employeeFilter === 'Unassigned' && styles.empChipActive]}
            onPress={() => setEmployeeFilter('Unassigned')}
          >
            <Text style={[styles.empChipText, employeeFilter === 'Unassigned' && styles.empChipTextActive]}>
              Unassigned
            </Text>
          </TouchableOpacity>

          {employees.map(emp => (
            <TouchableOpacity
              key={emp.id}
              style={[styles.empChip, employeeFilter === emp.id && styles.empChipActive]}
              onPress={() => setEmployeeFilter(emp.id)}
            >
              <Text style={[styles.empChipText, employeeFilter === emp.id && styles.empChipTextActive]}>
                {emp.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Filter Row 2: Status & Temperature Badges */}
      <View style={styles.statusAndTempRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {STATUS_FILTERS.map(st => (
            <TouchableOpacity
              key={st}
              style={[styles.pillChip, statusFilter === st && styles.pillChipActive]}
              onPress={() => setStatusFilter(st)}
            >
              <Text style={[styles.pillChipText, statusFilter === st && styles.pillChipTextActive]}>
                {st === 'Success' ? 'Won' : st === 'Closed' ? 'Lost' : st}
              </Text>
            </TouchableOpacity>
          ))}
          <View style={styles.dividerVer} />
          {TEMP_FILTERS.map(tp => (
            <TouchableOpacity
              key={tp}
              style={[styles.pillChip, tempFilter === tp && styles.pillChipActive]}
              onPress={() => setTempFilter(tp)}
            >
              <Text style={[styles.pillChipText, tempFilter === tp && styles.pillChipTextActive]}>
                {tp === 'Hot' ? '🔥 Hot' : tp === 'Warm' ? '☀️ Warm' : tp === 'Cold' ? '❄️ Cold' : 'All Temp'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={{ marginTop: 10, color: Colors.textMuted }}>Loading Leads...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredLeads}
          keyExtractor={item => item.id.toString()}
          renderItem={renderLeadCard}
          contentContainerStyle={styles.listContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <User size={36} color={Colors.textMuted} />
              <Text style={styles.emptyCardTitle}>No Leads Found</Text>
              <Text style={styles.emptyCardSub}>
                {activeFiltersCount > 0
                  ? 'No leads matching the selected filter criteria. Try resetting filters.'
                  : 'Tap "+ New" to add your first customer enquiry.'}
              </Text>
              {activeFiltersCount > 0 && (
                <TouchableOpacity
                  style={styles.resetFiltersBtn}
                  onPress={() => {
                    setStatusFilter('All');
                    setTempFilter('All');
                    setEmployeeFilter('All');
                    setServiceFilter('All Services');
                    setSearchTerm('');
                  }}
                >
                  <Text style={styles.resetFiltersText}>Reset All Filters</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      {/* Advanced Filter & Sort Modal */}
      <Modal visible={isFilterModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeading}>Filter & Sort Leads</Text>
              <TouchableOpacity onPress={() => setIsFilterModalOpen(false)}>
                <X size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* Service Type Filter */}
              <Text style={styles.modalSubheading}>Filter by Enrolled Service</Text>
              <View style={styles.modalWrapGrid}>
                {COMMON_SERVICES.map(srv => (
                  <TouchableOpacity
                    key={srv}
                    style={[styles.modalGridChip, serviceFilter === srv && styles.modalGridChipActive]}
                    onPress={() => setServiceFilter(srv)}
                  >
                    <Text style={[styles.modalGridText, serviceFilter === srv && styles.modalGridTextActive]}>
                      {srv}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Sort Order */}
              <Text style={[styles.modalSubheading, { marginTop: 16 }]}>Sort Order</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[
                  { id: 'newest', label: 'Newest First' },
                  { id: 'oldest', label: 'Oldest First' },
                  { id: 'name', label: 'Name (A-Z)' },
                ].map(sort => (
                  <TouchableOpacity
                    key={sort.id}
                    style={[styles.sortBtn, sortOrder === sort.id && styles.sortBtnActive]}
                    onPress={() => setSortOrder(sort.id as any)}
                  >
                    <Text style={[styles.sortBtnText, sortOrder === sort.id && styles.sortBtnTextActive]}>
                      {sort.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={styles.modalApplyBtn}
                onPress={() => setIsFilterModalOpen(false)}
              >
                <Text style={styles.modalApplyText}>Apply Filters</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  filterBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  filterBtnActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  filterCountBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#DC2626',
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterCountText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
    padding: 0,
  },
  filterSectionRow: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  filterLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  filterChipScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingBottom: 4,
  },
  empChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  empChipActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  empChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  empChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  statusAndTempRow: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  pillChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  pillChipActive: {
    backgroundColor: '#2563EB',
  },
  pillChipText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#475569',
  },
  pillChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  dividerVer: {
    width: 1,
    backgroundColor: Colors.border,
    height: 18,
    alignSelf: 'center',
    marginHorizontal: 2,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  name: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text,
  },
  phone: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  addressText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  serviceText: {
    fontSize: 11,
    color: Colors.primaryDark,
    fontWeight: '600',
    marginTop: 3,
  },
  rightCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  tempBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  tempIcon: {
    fontSize: 10,
  },
  tempText: {
    fontSize: 9.5,
    fontWeight: 'bold',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 6,
  },
  assignedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    maxWidth: 120,
  },
  assignedText: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  sourceTag: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sourceText: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  dateText: {
    fontSize: 10.5,
    color: Colors.textMuted,
  },
  callCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 30,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyCardTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 8,
  },
  emptyCardSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  resetFiltersBtn: {
    marginTop: 14,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
  },
  resetFiltersText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
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
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalHeading: {
    fontSize: 17,
    fontWeight: 'bold',
    color: Colors.text,
  },
  modalSubheading: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  modalWrapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modalGridChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalGridChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  modalGridText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  modalGridTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  sortBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  sortBtnActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  sortBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  sortBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalApplyBtn: {
    backgroundColor: Colors.primaryDark,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  modalApplyText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
