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
  Platform,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Search,
  Monitor,
  User,
  Clock,
  Shield,
  Layers,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function AuditLogsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 20);
  const { isAdmin } = useAuth();

  const [logs, setLogs] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedEmps, setExpandedEmps] = useState<string[]>([]);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const [logsRes, empRes] = await Promise.all([
        supabase
          .from('audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(300),
        supabase
          .from('employees')
          .select('id, name, designation')
          .order('name', { ascending: true }),
      ]);

      if (logsRes.data) setLogs(logsRes.data);
      if (empRes.data) setEmployees(empRes.data);
    } catch (e: any) {
      console.warn('Audit logs fetch error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchLogs();
  };

  const toggleExpand = (empName: string) => {
    setExpandedEmps(prev =>
      prev.includes(empName) ? prev.filter(e => e !== empName) : [...prev, empName]
    );
  };

  const timeAgo = (dateStr: string) => {
    if (!dateStr) return 'Never';
    const diff = new Date().getTime() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const filteredLogs = logs.filter(log => {
    const q = searchTerm.toLowerCase();
    return (
      (log.employee_name && log.employee_name.toLowerCase().includes(q)) ||
      (log.action_type && log.action_type.toLowerCase().includes(q)) ||
      (log.description && log.description.toLowerCase().includes(q)) ||
      (log.module && log.module.toLowerCase().includes(q))
    );
  });

  // Group logs by employee
  const grouped: Record<string, { logs: any[]; designation: string }> = {};

  employees.forEach(emp => {
    grouped[emp.name] = { logs: [], designation: emp.designation || 'Staff' };
  });

  filteredLogs.forEach(log => {
    const empName = log.employee_name || 'System / Unknown';
    if (!grouped[empName]) {
      grouped[empName] = { logs: [], designation: 'System' };
    }
    grouped[empName].logs.push(log);
  });

  const employeeNames = Object.keys(grouped).sort((a, b) => {
    const aLogs = grouped[a].logs;
    const bLogs = grouped[b].logs;
    if (aLogs.length === 0 && bLogs.length === 0) return a.localeCompare(b);
    if (aLogs.length === 0) return 1;
    if (bLogs.length === 0) return -1;
    return new Date(bLogs[0].created_at).getTime() - new Date(aLogs[0].created_at).getTime();
  });

  if (!isAdmin) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: safeTop, paddingHorizontal: 24 }]}>
        <Shield size={48} color={Colors.danger} />
        <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.text, marginTop: 16 }}>Access Restricted</Text>
        <Text style={{ fontSize: 13, color: Colors.textMuted, marginTop: 6, textAlign: 'center', lineHeight: 20 }}>
          System Audit Logs are strictly reserved for System Administrators.
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
          <Text style={styles.topBarTitle}>System Audit Logs</Text>
          <Text style={styles.topBarSub}>Security, user operations & change history</Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
          <RefreshCw size={18} color={Colors.primaryDark} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchBox}>
          <Search size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by user, action, module..."
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholderTextColor={Colors.textMuted}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Fetching audit events...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {employeeNames.map(name => {
            const data = grouped[name];
            const isExpanded = expandedEmps.includes(name);
            const count = data.logs.length;

            if (!isAdmin) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: safeTop, paddingHorizontal: 24 }]}>
        <Shield size={48} color={Colors.danger} />
        <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.text, marginTop: 16 }}>Access Restricted</Text>
        <Text style={{ fontSize: 13, color: Colors.textMuted, marginTop: 6, textAlign: 'center', lineHeight: 20 }}>
          System Audit Logs are strictly reserved for System Administrators.
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
              <View key={name} style={styles.empCard}>
                <TouchableOpacity
                  style={styles.empHeader}
                  onPress={() => toggleExpand(name)}
                  activeOpacity={0.7}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.empName}>{name}</Text>
                    <Text style={styles.empDesig}>{data.designation}</Text>
                  </View>
                  <View style={styles.badgeRow}>
                    <View style={[styles.countBadge, count > 0 ? styles.countBadgeActive : null]}>
                      <Text style={[styles.countText, count > 0 ? styles.countTextActive : null]}>
                        {count} {count === 1 ? 'action' : 'actions'}
                      </Text>
                    </View>
                    {isExpanded ? (
                      <ChevronUp size={20} color={Colors.textMuted} />
                    ) : (
                      <ChevronDown size={20} color={Colors.textMuted} />
                    )}
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.logsList}>
                    {count === 0 ? (
                      <Text style={styles.noLogsText}>No recent activity logged for this user.</Text>
                    ) : (
                      data.logs.map((log, idx) => (
                        <View key={log.id || idx} style={styles.logItem}>
                          <View style={styles.logTop}>
                            <View style={styles.moduleTag}>
                              <Layers size={11} color={Colors.primaryDark} />
                              <Text style={styles.moduleTagText}>{log.module || 'System'}</Text>
                            </View>
                            <Text style={styles.logTime}>{timeAgo(log.created_at)}</Text>
                          </View>
                          <Text style={styles.logAction}>{log.action_type || 'Update'}</Text>
                          {log.description ? (
                            <Text style={styles.logDesc}>{log.description}</Text>
                          ) : null}
                        </View>
                      ))
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
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
  refreshBtn: { padding: 6, backgroundColor: Colors.primaryLight, borderRadius: 8 },
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
  scrollContent: { padding: 16, paddingBottom: 60 },
  empCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  empHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '700', color: Colors.primaryDark },
  empName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  empDesig: { fontSize: 12, color: Colors.textMuted },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  countBadge: {
    backgroundColor: Colors.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  countBadgeActive: {
    backgroundColor: Colors.primaryLight,
  },
  countText: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  countTextActive: { color: Colors.primaryDark },
  logsList: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: '#FAFAFA',
    padding: 12,
  },
  noLogsText: { fontSize: 12, color: Colors.textMuted, fontStyle: 'italic', padding: 6 },
  logItem: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  logTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  moduleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  moduleTagText: { fontSize: 10, fontWeight: '700', color: Colors.primaryDark },
  logTime: { fontSize: 11, color: Colors.textMuted },
  logAction: { fontSize: 12, fontWeight: '700', color: Colors.text },
  logDesc: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
});
