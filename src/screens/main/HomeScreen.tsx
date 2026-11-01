import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Bell,
  Calendar,
  Users,
  Briefcase,
  Layers,
  CheckSquare,
  IndianRupee,
  Plus,
  FileText,
  ShieldAlert,
  Award,
  ChevronRight,
  TrendingUp,
  Clock,
  Building,
  Monitor,
  Key,
  UserPlus,
  UserCheck,
} from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { fetchUserNotifications, startRealtimeNotificationListener } from '../../lib/notificationService';

export default function HomeScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 20);
  const { user, role, isAdmin, isClient } = useAuth();
  const [counts, setCounts] = useState({
    leads: 0,
    clients: 0,
    projects: 0,
    services: 0,
    tasks: 0,
  });
  const [finSummary, setFinSummary] = useState({
    received: '₹ 0',
    due: '₹ 0',
  });
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      let leadsQuery = supabase.from('leads').select('*', { count: 'exact', head: true });
      let clientsQuery = supabase.from('clients').select('*', { count: 'exact', head: true });
      let projectsQuery = supabase.from('projects').select('*', { count: 'exact', head: true });
      let servicesQuery = supabase.from('services').select('*', { count: 'exact', head: true });
      let tasksQuery = supabase.from('tasks').select('*', { count: 'exact', head: true });

      if (!isAdmin && role !== 'CRO' && user?.name) {
        leadsQuery = leadsQuery.eq('assigned_to', user.name);
        clientsQuery = clientsQuery.eq('assigned_to', user.name);
        projectsQuery = projectsQuery.eq('assigned_to', user.name);
      }

      const [lRes, cRes, pRes, sRes, tRes] = await Promise.all([
        leadsQuery,
        clientsQuery,
        projectsQuery,
        servicesQuery,
        tasksQuery,
      ]);

      setCounts({
        leads: lRes.count || 0,
        clients: cRes.count || 0,
        projects: pRes.count || 0,
        services: sRes.count || 0,
        tasks: tRes.count || 0,
      });

      if (isAdmin) {
        const [servicesRes, projectsRes] = await Promise.all([
          supabase.from('services').select('description'),
          supabase.from('projects').select('description'),
        ]);

        let grandTotal = 0;
        let grandPaid = 0;

        [...(servicesRes.data || []), ...(projectsRes.data || [])].forEach((item: any) => {
          try {
            let meta: any = {};
            if (typeof item.description === 'object' && item.description !== null) {
              meta = item.description;
            } else if (typeof item.description === 'string') {
              try { meta = JSON.parse(item.description); } catch (e) { meta = {}; }
            }

            const val = parseFloat(meta.financials?.total || 0) || 0;
            const adv = parseFloat(meta.financials?.advance || 0) || 0;
            const pay = Array.isArray(meta.payments) ? meta.payments : [];
            const pSum = pay.reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0);
            grandTotal += val;
            grandPaid += adv + pSum;
          } catch {}
        });

        const formatShort = (n: number) => {
          if (n >= 10000000) return `₹ ${(n / 10000000).toFixed(1)} Cr`;
          if (n >= 100000) return `₹ ${(n / 100000).toFixed(1)} L`;
          return `₹ ${n.toLocaleString('en-IN')}`;
        };

        setFinSummary({
          received: formatShort(grandPaid),
          due: formatShort(Math.max(grandTotal - grandPaid, 0)),
        });
      }

      if (!isClient) {
        const notifs = await fetchUserNotifications(role || 'Employee', user?.id);
        setUnreadCount(notifs.filter(n => !n.is_read).length);
      }
    } catch (e) {
      console.warn('Dashboard count error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();

    if (!isClient && (role || user)) {
      const unsubscribe = startRealtimeNotificationListener(role || 'Employee', user?.id, () => {
        loadData();
      });
      return () => {
        unsubscribe();
      };
    }
  }, [role, user]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '☀️ Good Morning,';
    if (hour < 17) return '🌤️ Good Afternoon,';
    return '🌙 Good Evening,';
  };

  const formattedDate = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <View style={[styles.container, { paddingTop: safeTop }]}>
      {/* Non-overlapping Top Bar */}
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <Image
            source={require('../../../assets/favicondayal.jpeg')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <View>
            <Text style={styles.brandTitle}>Dayal Constructions & Co.</Text>
            <Text style={styles.brandTagline}>BUILDING TRUST, SHAPING TOMORROW</Text>
          </View>
        </View>

        <View style={styles.topBarRight}>
          {!isClient && (
            <TouchableOpacity
              style={styles.notifBtn}
              onPress={() => navigation.navigate('Notifications')}
            >
              <Bell color={Colors.text} size={22} />
              {unreadCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.avatarCircle}
            onPress={() => navigation.navigate('MainApp', { screen: 'Profile' })}
          >
            <Text style={styles.avatarLetter}>
              {isAdmin ? 'AD' : role === 'CRO' ? 'CR' : 'ST'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* User Card */}
        <View style={styles.userBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greetingText}>{getGreeting()}</Text>
            <Text style={styles.userNameText}>{user?.name || (isAdmin ? 'Admin' : 'Team Member')}</Text>
            <View style={styles.roleTag}>
              {isAdmin ? (
                <ShieldAlert size={12} color="#92400E" />
              ) : (
                <Award size={12} color="#1D4ED8" />
              )}
              <Text style={styles.roleTagText}>
                {isAdmin ? 'System Administrator' : `${role || 'Staff'} Access`}
              </Text>
            </View>
          </View>
          <View style={styles.dateChip}>
            <Calendar size={13} color={Colors.textMuted} />
            <Text style={styles.dateChipText}>{formattedDate}</Text>
          </View>
        </View>

        {/* Core Metrics Grid */}
        <View style={styles.metricsGrid}>
          <MetricCard
            title={isAdmin || role === 'CRO' ? 'Total Leads' : 'My Leads'}
            value={loading ? '...' : counts.leads.toString()}
            icon={<Users size={20} color={Colors.primary} />}
            onPress={() => navigation.navigate('MainApp', { screen: 'Leads' })}
          />
          <MetricCard
            title="Total Clients"
            value={loading ? '...' : counts.clients.toString()}
            icon={<Users size={20} color="#3B82F6" />}
            onPress={() => navigation.navigate('MainApp', { screen: 'Clients' })}
          />
          <MetricCard
            title="Projects"
            value={loading ? '...' : counts.projects.toString()}
            icon={<Briefcase size={20} color="#8B5CF6" />}
            onPress={() => navigation.navigate('MainApp', { screen: 'Projects' })}
          />
          <MetricCard
            title="Pending Tasks"
            value={loading ? '...' : counts.tasks.toString()}
            icon={<CheckSquare size={20} color="#059669" />}
            onPress={() => navigation.navigate('MainApp', { screen: 'Tasks' })}
          />
        </View>

        {/* Quick Actions */}
        {!isClient && (
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>Quick Actions</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.actionRow}>
              <ActionItem
                icon={<Plus size={22} color={Colors.primaryDark} />}
                title="New Lead"
                bg="#E8F5E9"
                onPress={() => navigation.navigate('NewLead')}
              />
              <ActionItem
                icon={<Users size={22} color={Colors.primary} />}
                title="New Client"
                bg="#E3F2FD"
                onPress={() => navigation.navigate('NewClient')}
              />
              <ActionItem
                icon={<Briefcase size={22} color="#D97706" />}
                title="New Project"
                bg="#FFFBEB"
                onPress={() => navigation.navigate('NewProject')}
              />
              <ActionItem
                icon={<Clock size={22} color="#8B5CF6" />}
                title="Follow-Up"
                bg="#F5F3FF"
                onPress={() => navigation.navigate('FollowUps')}
              />
              <ActionItem
                icon={<UserCheck size={22} color="#059669" />}
                title="Assign Work"
                bg="#ECFDF5"
                onPress={() => navigation.navigate('Assignments')}
              />
            </ScrollView>
          </View>
        )}

        {/* Dedicated CRM Operations Hub (No duplicate of Bottom Bar) */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>CRM Operations Hub</Text>
          <View style={styles.modulesGrid}>
            <ModuleCard
              icon={<UserCheck size={24} color="#059669" />}
              title="Assignment Workflow & Delegations"
              subtitle="Assign leads, clients, projects & delegate tasks to team"
              badge={isAdmin ? 'Admin' : undefined}
              onPress={() => navigation.navigate('Assignments')}
            />
            <ModuleCard
              icon={<Clock size={24} color="#D97706" />}
              title="Follow-Ups Center"
              subtitle="Scheduled calls, client visits & lead reminders"
              onPress={() => navigation.navigate('FollowUps')}
            />
            {isAdmin && (
              <>
                <ModuleCard
                  icon={<IndianRupee size={24} color="#059669" />}
                  title="Financials & Revenue"
                  subtitle="Contract billing, payments & collections"
                  badge="Admin"
                  onPress={() => navigation.navigate('Finance')}
                />
                <ModuleCard
                  icon={<Monitor size={24} color="#2563EB" />}
                  title="System Audit Logs"
                  subtitle="Employee activity tracking & change history"
                  badge="Admin"
                  onPress={() => navigation.navigate('AuditLogs')}
                />
                <ModuleCard
                  icon={<UserPlus size={24} color="#7C3AED" />}
                  title="Employees & Staff Directory"
                  subtitle="Roles, designations & team contact info"
                  badge="Admin"
                  onPress={() => navigation.navigate('Employees')}
                />
                <ModuleCard
                  icon={<Key size={24} color="#EA580C" />}
                  title="Client Portal Logins"
                  subtitle="Issue & revoke client login access"
                  badge="Admin"
                  onPress={() => navigation.navigate('ClientLogins')}
                />
              </>
            )}
          </View>
        </View>

        {/* Admin Executive Summary Card */}
        {isAdmin && (
          <TouchableOpacity
            style={styles.adminExecutiveCard}
            onPress={() => navigation.navigate('Finance')}
            activeOpacity={0.85}
          >
            <View style={styles.adminExecutiveHeader}>
              <View>
                <Text style={styles.adminExecTitle}>Financials & Cashflow</Text>
                <Text style={styles.adminExecSub}>Total Booked Value vs. Collections</Text>
              </View>
              <ChevronRight size={20} color={Colors.textMuted} />
            </View>
            <View style={styles.adminExecStats}>
              <View>
                <Text style={styles.adminStatLabel}>Total Received</Text>
                <Text style={[styles.adminStatNum, { color: Colors.success }]}>{finSummary.received}</Text>
              </View>
              <View style={styles.statDivider} />
              <View>
                <Text style={styles.adminStatLabel}>Outstanding Due</Text>
                <Text style={[styles.adminStatNum, { color: Colors.danger }]}>{finSummary.due}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

// Subcomponents
const MetricCard = ({ title, value, icon, onPress }: any) => (
  <TouchableOpacity style={styles.metricCard} onPress={onPress} activeOpacity={0.7}>
    <View style={styles.metricCardHeader}>
      <View style={styles.metricIconCircle}>{icon}</View>
      <Text style={styles.metricTitleText}>{title}</Text>
    </View>
    <Text style={styles.metricValueText}>{value}</Text>
  </TouchableOpacity>
);

const ActionItem = ({ icon, title, bg, onPress }: any) => (
  <TouchableOpacity style={[styles.actionBox, { backgroundColor: bg }]} onPress={onPress}>
    {icon}
    <Text style={styles.actionBoxText}>{title}</Text>
  </TouchableOpacity>
);

const ModuleCard = ({ icon, title, subtitle, badge, onPress }: any) => (
  <TouchableOpacity style={styles.moduleCard} onPress={onPress} activeOpacity={0.7}>
    <View style={styles.moduleIconBox}>{icon}</View>
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={styles.moduleTitle}>{title}</Text>
        {badge && (
          <View style={styles.adminBadgeSmall}>
            <Text style={styles.adminBadgeSmallText}>{badge}</Text>
          </View>
        )}
      </View>
      <Text style={styles.moduleSub}>{subtitle}</Text>
    </View>
    <ChevronRight size={18} color={Colors.textMuted} />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoImage: {
    width: 38,
    height: 38,
    borderRadius: 8,
  },
  brandTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.text,
  },
  brandTagline: {
    fontSize: 8,
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notifBtn: {
    position: 'relative',
    padding: 4,
  },
  notifBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: Colors.danger,
    borderRadius: 9,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  userBanner: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greetingText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  userNameText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginVertical: 2,
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  roleTagText: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '600',
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.background,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  dateChipText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    width: '48%',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  metricCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  metricIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricTitleText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
    flex: 1,
  },
  metricValueText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.text,
  },
  section: {
    gap: 10,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  actionRow: {
    flexDirection: 'row',
  },
  actionBox: {
    width: 90,
    height: 90,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    padding: 8,
  },
  actionBoxText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 8,
    textAlign: 'center',
  },
  modulesGrid: {
    gap: 10,
  },
  moduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  moduleIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moduleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  moduleSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  adminBadgeSmall: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  adminBadgeSmallText: {
    fontSize: 10,
    color: '#15803D',
    fontWeight: 'bold',
  },
  adminExecutiveCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primaryDark,
  },
  adminExecutiveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  adminExecTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.text,
  },
  adminExecSub: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  adminExecStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  adminStatLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  adminStatNum: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.border,
  },
});
