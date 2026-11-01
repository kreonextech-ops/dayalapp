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
  IndianRupee,
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
  RefreshCw,
  Search,
  Filter,
  ChevronRight,
  ShieldAlert,
  Clock,
  CheckCircle2,
} from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function FinanceScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 20);
  const { isAdmin } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [financialData, setFinancialData] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'this_month' | 'last_month' | 'this_year'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'due' | 'paid'>('all');

  useEffect(() => {
    loadFinances();
  }, []);

  const loadFinances = async () => {
    setLoading(true);
    try {
      const [clientsRes, servicesRes, projectsRes] = await Promise.all([
        supabase.from('clients').select('id, name').order('name', { ascending: true }),
        supabase.from('services').select('id, client_id, description'),
        supabase.from('projects').select('id, client_id, description'),
      ]);

      const cData = clientsRes.data || [];
      const srvData = servicesRes.data || [];
      const prjData = projectsRes.data || [];

      const parsedClients = cData.map(c => {
        const clientServices = srvData.filter(s => s.client_id === c.id);
        const clientProjects = prjData.filter(p => p.client_id === c.id);
        const allItems = [...clientServices, ...clientProjects];

        let totalValue = 0;
        let totalPaidAllTime = 0;
        const allPayments: any[] = [];

        allItems.forEach(item => {
          try {
            let meta: any = {};
            if (typeof item.description === 'object' && item.description !== null) {
              meta = item.description;
            } else if (typeof item.description === 'string') {
              try {
                meta = JSON.parse(item.description);
              } catch (e) {
                meta = {};
              }
            }

            const val = parseFloat(meta.financials?.total || 0) || 0;
            const adv = parseFloat(meta.financials?.advance || 0) || 0;
            const payments = Array.isArray(meta.payments) ? meta.payments : [];

            totalValue += val;
            let itemPaid = adv;

            payments.forEach((p: any) => {
              const pAmt = parseFloat(p.amount) || 0;
              itemPaid += pAmt;
              allPayments.push({ ...p, amount: pAmt, date: p.date });
            });

            totalPaidAllTime += itemPaid;
          } catch {}
        });

        return {
          id: c.id,
          name: c.name,
          totalValue,
          totalPaidAllTime,
          totalDue: Math.max(totalValue - totalPaidAllTime, 0),
          allPayments,
        };
      });

      setFinancialData(parsedClients);
    } catch (e: any) {
      console.warn('Finance calculation error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadFinances();
  };

  // Date period bounds
  const getDateBounds = () => {
    const now = new Date();
    let start: Date | null = null;
    let end: Date | null = null;

    if (periodFilter === 'this_month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (periodFilter === 'last_month') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    } else if (periodFilter === 'this_year') {
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    }

    return { start, end };
  };

  const { start, end } = getDateBounds();

  // Calculate filtered data
  let globalExpected = 0;
  let globalReceivedAllTime = 0;
  let globalReceivedInPeriod = 0;
  let globalDue = 0;

  const clientRows = financialData
    .map(c => {
      let periodPaid = 0;

      c.allPayments.forEach((p: any) => {
        if (p.date && start && end) {
          const pDate = new Date(p.date);
          if (pDate >= start && pDate <= end) {
            periodPaid += p.amount;
          }
        } else if (!start) {
          periodPaid += p.amount;
        }
      });

      // All-time includes advances
      if (periodFilter === 'all') {
        periodPaid = c.totalPaidAllTime;
      }

      globalExpected += c.totalValue;
      globalReceivedAllTime += c.totalPaidAllTime;
      globalReceivedInPeriod += periodPaid;
      globalDue += c.totalDue;

      return {
        ...c,
        periodPaid,
      };
    })
    .filter(c => c.totalValue > 0 || c.periodPaid > 0);

  // Apply Search & Status Filter
  const filteredClients = clientRows.filter(c => {
    const matchSearch = searchTerm.trim()
      ? c.name?.toLowerCase().includes(searchTerm.toLowerCase())
      : true;

    if (!matchSearch) return false;

    if (statusFilter === 'due') {
      return c.totalDue > 0;
    }
    if (statusFilter === 'paid') {
      return c.totalDue === 0 && c.totalPaidAllTime > 0;
    }
    return true;
  });

  // Sort by Due descending
  filteredClients.sort((a, b) => b.totalDue - a.totalDue);

  const formatCurrency = (num: number) => {
    if (num >= 10000000) {
      return `₹ ${(num / 10000000).toFixed(2)} Cr`;
    }
    if (num >= 100000) {
      return `₹ ${(num / 100000).toFixed(2)} L`;
    }
    return `₹ ${Math.round(num).toLocaleString('en-IN')}`;
  };

  if (!isAdmin) {
    return (
      <View style={[styles.center, { paddingTop: safeTop, paddingHorizontal: 24 }]}>
        <ShieldAlert size={48} color={Colors.danger} />
        <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.text, marginTop: 16 }}>Access Restricted</Text>
        <Text style={{ fontSize: 13, color: Colors.textMuted, marginTop: 6, textAlign: 'center', lineHeight: 20 }}>
          Company Financials, Revenue Analytics & Ledgers are strictly reserved for System Administrators.
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

  const collectionPercent = globalExpected > 0 ? ((globalReceivedAllTime / globalExpected) * 100).toFixed(1) : '0';

  return (
    <View style={[styles.container, { paddingTop: safeTop }]}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.topBarTitle}>Company Financials & Revenue</Text>
          <Text style={styles.topBarSub}>Dayal Construction Master Billing Ledger</Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
          <RefreshCw size={18} color={Colors.primaryDark} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* KPI Summary Cards */}
        <View style={styles.kpiContainer}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total Booked Value</Text>
            <Text style={styles.kpiValue}>{loading ? '...' : formatCurrency(globalExpected)}</Text>
            <Text style={styles.kpiSub}>Contract billing sum</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total Received</Text>
            <Text style={[styles.kpiValue, { color: Colors.success }]}>
              {loading ? '...' : formatCurrency(periodFilter === 'all' ? globalReceivedAllTime : globalReceivedInPeriod)}
            </Text>
            <Text style={styles.kpiSub}>
              {periodFilter === 'all' ? `All-time collected (${collectionPercent}%)` : `In selected period`}
            </Text>
          </View>
        </View>

        <View style={styles.kpiCardFull}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={styles.kpiLabel}>Total Outstanding Due</Text>
              <Text style={[styles.kpiValue, { color: Colors.danger }]}>
                {loading ? '...' : formatCurrency(globalDue)}
              </Text>
            </View>
            <View style={styles.recoveryBox}>
              <Text style={styles.recoveryLabel}>Realized Rate</Text>
              <Text style={styles.recoveryVal}>{collectionPercent}%</Text>
            </View>
          </View>
        </View>

        {/* ===================== FILTER CONTROLS ===================== */}
        <View style={styles.filterSection}>
          <Text style={styles.filterSectionHeading}>Period Filter</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {[
              { id: 'all', label: 'All Time' },
              { id: 'this_month', label: 'This Month' },
              { id: 'last_month', label: 'Last Month' },
              { id: 'this_year', label: 'This Year' },
            ].map(p => (
              <TouchableOpacity
                key={p.id}
                style={[styles.filterChip, periodFilter === p.id && styles.filterChipActive]}
                onPress={() => setPeriodFilter(p.id as any)}
              >
                <Text style={[styles.filterChipText, periodFilter === p.id && styles.filterChipTextActive]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[styles.filterSectionHeading, { marginTop: 12 }]}>Status Filter</Text>
          <View style={styles.statusChipRow}>
            {[
              { id: 'all', label: 'All Clients' },
              { id: 'due', label: 'Outstanding Due' },
              { id: 'paid', label: 'Fully Paid / Clear' },
            ].map(s => (
              <TouchableOpacity
                key={s.id}
                style={[styles.statusChip, statusFilter === s.id && styles.statusChipActive]}
                onPress={() => setStatusFilter(s.id as any)}
              >
                <Text style={[styles.statusChipText, statusFilter === s.id && styles.statusChipTextActive]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Search Box */}
          <View style={styles.searchBox}>
            <Search size={16} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search client by name..."
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholderTextColor={Colors.textMuted}
            />
          </View>
        </View>

        {/* Client Ledger Breakdown */}
        <View style={styles.ledgerSection}>
          <View style={styles.ledgerHeaderRow}>
            <Text style={styles.ledgerHeading}>Client Ledger Breakdown</Text>
            <Text style={styles.ledgerCount}>{filteredClients.length} Clients</Text>
          </View>

          {loading ? (
            <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 20 }} />
          ) : filteredClients.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No matching client ledger records found.</Text>
            </View>
          ) : (
            filteredClients.map((client, index) => (
              <TouchableOpacity
                key={client.id || index}
                style={styles.clientCard}
                onPress={() => navigation.navigate('ClientDetails', { id: client.id })}
                activeOpacity={0.7}
              >
                <View style={styles.clientTop}>
                  <Text style={styles.clientName}>{client.name}</Text>
                  <ChevronRight size={16} color={Colors.textMuted} />
                </View>

                <View style={styles.ledgerGrid}>
                  <View style={styles.ledgerCol}>
                    <Text style={styles.ledgerLabel}>Total Booked</Text>
                    <Text style={styles.ledgerVal}>{formatCurrency(client.totalValue)}</Text>
                  </View>
                  <View style={styles.ledgerCol}>
                    <Text style={styles.ledgerLabel}>Total Received</Text>
                    <Text style={[styles.ledgerVal, { color: Colors.success }]}>
                      {formatCurrency(periodFilter === 'all' ? client.totalPaidAllTime : client.periodPaid)}
                    </Text>
                  </View>
                  <View style={[styles.ledgerCol, { alignItems: 'flex-end' }]}>
                    <Text style={styles.ledgerLabel}>Pending Due</Text>
                    <Text style={[styles.ledgerVal, { color: client.totalDue > 0 ? Colors.danger : Colors.textMuted }]}>
                      {client.totalDue > 0 ? formatCurrency(client.totalDue) : 'PAID'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { padding: 6 },
  topBarTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  topBarSub: { fontSize: 11, color: Colors.textMuted },
  refreshBtn: { padding: 6 },
  scrollContent: { padding: 16, paddingBottom: 40, gap: 14 },
  kpiContainer: { flexDirection: 'row', gap: 12 },
  kpiCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  kpiCardFull: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  kpiLabel: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase' },
  kpiValue: { fontSize: 20, fontWeight: 'bold', color: Colors.text, marginTop: 4 },
  kpiSub: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  recoveryBox: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  recoveryLabel: { fontSize: 10, fontWeight: '700', color: '#2563EB', textTransform: 'uppercase' },
  recoveryVal: { fontSize: 16, fontWeight: 'bold', color: '#1D4ED8' },
  filterSection: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterSectionHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  statusChipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusChip: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  statusChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  statusChipTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
  },
  ledgerSection: {
    gap: 10,
  },
  ledgerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ledgerHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  ledgerCount: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  clientCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  clientTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  clientName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  ledgerGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ledgerCol: {
    flex: 1,
  },
  ledgerLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  ledgerVal: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 2,
  },
  emptyCard: {
    padding: 24,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 13,
    color: Colors.textMuted,
  },
});
