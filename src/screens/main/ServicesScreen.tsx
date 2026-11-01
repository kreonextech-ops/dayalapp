import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Search, Plus, ChevronRight, Layers } from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const SERVICE_STATUS_TABS = ['All', 'Pending', 'In Progress', 'On Hold', 'In Review', 'Completed'];

export default function ServicesScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 20);
  const [services, setServices] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { role, user, isAdmin } = useAuth();

  useEffect(() => {
    fetchServices();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchTerm, statusFilter, services]);

  const fetchServices = async () => {
    setLoading(true);
    try {
      let query = supabase.from('services').select('*').order('created_at', { ascending: false });

      if (!isAdmin && role !== 'CRO' && user?.name) {
        query = query.like('assigned_to', `%${user.name}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setServices(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applyFilters = () => {
    let result = [...services];

    if (statusFilter !== 'All') {
      result = result.filter(
        s => (s.status || 'Pending').toLowerCase() === statusFilter.toLowerCase()
      );
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        s =>
          (s.title && s.title.toLowerCase().includes(q)) ||
          (s.name && s.name.toLowerCase().includes(q)) ||
          (s.category && s.category.toLowerCase().includes(q))
      );
    }

    setFiltered(result);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchServices();
  };

  const getStatusStyle = (status: string) => {
    switch ((status || 'Pending').toLowerCase()) {
      case 'completed':
        return { color: '#16A34A', bg: '#DCFCE7' };
      case 'in progress':
        return { color: '#133E2B', bg: '#E8F5E9' };
      case 'on hold':
      case 'in review':
        return { color: '#D97706', bg: '#FFFBEB' };
      case 'cancelled':
        return { color: '#DC2626', bg: '#FEE2E2' };
      default:
        return { color: '#2563EB', bg: '#EFF6FF' };
    }
  };

  const renderServiceCard = ({ item }: any) => {
    const statusStyle = getStatusStyle(item.status);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('ServiceDetails', { id: item.id })}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeaderRow}>
          <View style={styles.avatar}>
            <Layers size={20} color={Colors.primaryDark} />
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.name}>{item.name || item.title || 'Consultancy Service'}</Text>
            <Text style={styles.category}>{item.category || 'Architectural / Legal'}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.badgeText, { color: statusStyle.color }]}>
              {item.status || 'Pending'}
            </Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.idText}>CASE: SRV-{item.id.toString().substring(0, 5).toUpperCase()}</Text>
          <View style={{ flex: 1 }} />
          <Text style={styles.assigned}>
            {item.assigned_to ? `Assigned: ${item.assigned_to.split(',')[0]}` : 'Assigned to Design'}
          </Text>
          <ChevronRight size={18} color={Colors.textMuted} style={{ marginLeft: 6 }} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: safeTop }]}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
            <ArrowLeft size={22} color={Colors.text} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Consultancy Services</Text>
            <Text style={styles.headerSubtitle}>{services.length} active architectural & legal cases</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('NewService')}>
          <Plus size={18} color="#FFFFFF" />
          <Text style={styles.addBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchBox}>
        <Search size={18} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by case name or design type..."
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholderTextColor={Colors.textMuted}
        />
      </View>

      {/* Status Filter Scroll */}
      <View style={styles.statusScrollWrapper}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={SERVICE_STATUS_TABS}
          keyExtractor={item => item}
          contentContainerStyle={styles.statusScroll}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.statusFilterChip, statusFilter === item && styles.statusFilterChipActive]}
              onPress={() => setStatusFilter(item)}
            >
              <Text
                style={[
                  styles.statusFilterText,
                  statusFilter === item && styles.statusFilterTextActive,
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Syncing Services...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id.toString()}
          renderItem={renderServiceCard}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No Consultancy Cases</Text>
              <Text style={styles.emptySubtitle}>No records match current filter.</Text>
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
  statusScrollWrapper: {
    marginVertical: 8,
  },
  statusScroll: {
    paddingHorizontal: 16,
    gap: 6,
  },
  statusFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusFilterChipActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  statusFilterText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  statusFilterTextActive: {
    color: '#FFFFFF',
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
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoBox: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.text,
  },
  category: {
    fontSize: 12,
    color: Colors.primaryDark,
    fontWeight: '600',
    marginTop: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
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
  assigned: {
    fontSize: 11,
    color: Colors.textMuted,
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
