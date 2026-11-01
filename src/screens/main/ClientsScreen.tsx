import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  RefreshControl,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, Phone, Plus, ChevronRight } from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const CLIENT_STATUS_FILTERS = ['All', 'Ongoing', 'Hold', 'Closed', 'Active'];
const TEMP_FILTERS = ['All', 'Hot', 'Warm', 'Cold'];

export default function ClientsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 20);
  const [clients, setClients] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [tempFilter, setTempFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { role, user, isAdmin } = useAuth();

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchTerm, statusFilter, tempFilter, clients]);

  const fetchClients = async () => {
    setLoading(true);
    try {
      let query = supabase.from('clients').select('*').order('created_at', { ascending: false });

      if (!isAdmin && role !== 'CRO' && user?.name) {
        query = query.like('assigned_to', `%${user.name}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setClients(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applyFilters = () => {
    let result = [...clients];

    if (statusFilter !== 'All') {
      result = result.filter(
        c => (c.status || 'Ongoing').toLowerCase() === statusFilter.toLowerCase()
      );
    }

    if (tempFilter !== 'All') {
      result = result.filter(
        c => (c.lead_temperature || 'Warm').toLowerCase() === tempFilter.toLowerCase()
      );
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        c =>
          c.name?.toLowerCase().includes(q) ||
          c.phone?.includes(q) ||
          c.company?.toLowerCase().includes(q) ||
          c.address?.toLowerCase().includes(q)
      );
    }

    setFiltered(result);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchClients();
  };

  const handleCall = (phone: string, e: any) => {
    e.stopPropagation();
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  const getStatusStyle = (status: string) => {
    switch ((status || 'Ongoing').toLowerCase()) {
      case 'active':
        return { color: '#16A34A', bg: '#DCFCE7' };
      case 'closed':
        return { color: '#DC2626', bg: '#FEE2E2' };
      case 'hold':
        return { color: '#2563EB', bg: '#EFF6FF' };
      default:
        return { color: '#D97706', bg: '#FFFBEB' };
    }
  };

  const getTempStyle = (temp: string) => {
    switch ((temp || 'Warm').toLowerCase()) {
      case 'hot':
        return { icon: '🔥', label: 'Hot', color: '#DC2626', bg: '#FEE2E2' };
      case 'cold':
        return { icon: '❄️', label: 'Cold', color: '#2563EB', bg: '#EFF6FF' };
      default:
        return { icon: '☀️', label: 'Warm', color: '#D97706', bg: '#FFFBEB' };
    }
  };

  const renderClientCard = ({ item }: any) => {
    const initial = item.name ? item.name.charAt(0).toUpperCase() : '?';
    const statusStyle = getStatusStyle(item.status);
    const tempStyle = getTempStyle(item.lead_temperature);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('ClientDetails', { id: item.id })}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeaderRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.name}>{item.name}</Text>
            {item.company && <Text style={styles.company}>{item.company}</Text>}
            <Text style={styles.phone}>{item.phone || 'No contact phone'}</Text>
          </View>
          <View style={styles.rightCol}>
            <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
              <Text style={[styles.statusBadgeText, { color: statusStyle.color }]}>
                {item.status || 'Ongoing'}
              </Text>
            </View>

            <View style={[styles.tempBadge, { backgroundColor: tempStyle.bg }]}>
              <Text style={styles.tempIcon}>{tempStyle.icon}</Text>
              <Text style={[styles.tempText, { color: tempStyle.color }]}>{tempStyle.label}</Text>
            </View>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.idText}>ID: CL-{item.id.substring(0, 6).toUpperCase()}</Text>
          <View style={{ flex: 1 }} />
          {item.phone && (
            <TouchableOpacity style={styles.callCircle} onPress={(e) => handleCall(item.phone, e)}>
              <Phone size={14} color={Colors.success} />
            </TouchableOpacity>
          )}
          <ChevronRight size={18} color={Colors.textMuted} style={{ marginLeft: 6 }} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: safeTop }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Clients Directory</Text>
          <Text style={styles.headerSubtitle}>{clients.length} onboarded accounts</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('NewClient')}>
          <Plus size={18} color="#FFFFFF" />
          <Text style={styles.addBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchBox}>
        <Search size={18} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by client name, phone or company..."
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholderTextColor={Colors.textMuted}
        />
      </View>

      {/* Filter Row 1: Status Filters */}
      <View style={styles.filterScrollWrapper}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CLIENT_STATUS_FILTERS}
          keyExtractor={item => item}
          contentContainerStyle={styles.filterScroll}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.filterChip, statusFilter === item && styles.filterChipActive]}
              onPress={() => setStatusFilter(item)}
            >
              <Text style={[styles.filterChipText, statusFilter === item && styles.filterChipTextActive]}>
                {item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Filter Row 2: Temperature Filters */}
      <View style={styles.tempFilterRow}>
        {TEMP_FILTERS.map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tempPill, tempFilter === t && styles.tempPillActive]}
            onPress={() => setTempFilter(t)}
          >
            <Text style={[styles.tempPillText, tempFilter === t && styles.tempPillTextActive]}>
              {t === 'Hot' ? '🔥 Hot' : t === 'Warm' ? '☀️ Warm' : t === 'Cold' ? '❄️ Cold' : 'All Temp'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Syncing Clients...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id.toString()}
          renderItem={renderClientCard}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No Clients Found</Text>
              <Text style={styles.emptySubtitle}>No records match current search.</Text>
            </View>
          }
        />
      )}
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
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: Colors.textMuted,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 8,
    fontSize: 13,
    color: Colors.text,
  },
  filterScrollWrapper: {
    marginTop: 8,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  tempFilterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 6,
    marginTop: 6,
    marginBottom: 8,
  },
  tempPill: {
    flex: 1,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  tempPillActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
  },
  tempPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  tempPillTextActive: {
    color: '#1D4ED8',
    fontWeight: 'bold',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primaryDark,
  },
  infoBox: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.text,
  },
  company: {
    fontSize: 12,
    color: Colors.primaryDark,
    fontWeight: '600',
    marginTop: 1,
  },
  phone: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  rightCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10.5,
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
    fontSize: 11,
  },
  tempText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  idText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  callCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.text,
  },
  emptySubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
  },
});
