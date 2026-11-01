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
import { Search, Plus, ChevronRight, Briefcase } from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const PROJECT_STATUS_TABS = ['All', 'Pending', 'In Progress', 'On Hold', 'In Review', 'Completed'];

export default function ProjectsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 20);
  const [projects, setProjects] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { role, user, isAdmin } = useAuth();

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchTerm, statusFilter, projects]);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      let query = supabase.from('projects').select('*').order('created_at', { ascending: false });

      if (!isAdmin && role !== 'CRO' && user?.name) {
        query = query.like('assigned_to', `%${user.name}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setProjects(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applyFilters = () => {
    let result = [...projects];

    if (statusFilter !== 'All') {
      result = result.filter(
        p => (p.status || 'Pending').toLowerCase() === statusFilter.toLowerCase()
      );
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        p =>
          p.name?.toLowerCase().includes(q) ||
          p.title?.toLowerCase().includes(q) ||
          p.assigned_to?.toLowerCase().includes(q)
      );
    }

    setFiltered(result);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchProjects();
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

  const renderProjectCard = ({ item }: any) => {
    let meta: any = {};
    try {
      meta = typeof item.description === 'string' && item.description.startsWith('{')
        ? JSON.parse(item.description)
        : {};
    } catch {
      meta = {};
    }

    const progress = item.progress_details?.percentage || meta.progress || 30;
    const statusStyle = getStatusStyle(item.status);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('ProjectDetails', { id: item.id })}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeaderRow}>
          <View style={styles.avatar}>
            <Briefcase size={20} color={Colors.primaryDark} />
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.idText}>SITE: PRJ-{item.id.substring(0, 6).toUpperCase()}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.badgeText, { color: statusStyle.color }]}>
              {item.status || 'Pending'}
            </Text>
          </View>
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressLabel}>{progress}%</Text>
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.assigned}>
            Incharge: {item.assigned_to || 'Engineering Team'}
          </Text>
          <ChevronRight size={18} color={Colors.textMuted} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: safeTop }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Construction Projects</Text>
          <Text style={styles.headerSubtitle}>{projects.length} sites in execution</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('NewProject')}>
          <Plus size={18} color="#FFFFFF" />
          <Text style={styles.addBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchBox}>
        <Search size={18} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search projects or site supervisor..."
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
          data={PROJECT_STATUS_TABS}
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
          <Text style={styles.loadingText}>Syncing Projects...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id.toString()}
          renderItem={renderProjectCard}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No Construction Projects</Text>
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
  idText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
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
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primaryDark,
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.textMuted,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  assigned: {
    fontSize: 12,
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
