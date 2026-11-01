import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  Clock,
  Users,
  Briefcase,
  CheckSquare,
  AlertCircle,
  Volume2,
  Sparkles,
  CheckCheck,
  PhoneCall,
  Calendar,
  Layers,
  UserCheck,
} from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import {
  fetchUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  triggerDevicePushNotification,
  NotificationItem,
} from '../../lib/notificationService';

export default function NotificationsScreen({ navigation }: any) {
  const { user, role, isClient } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const loadNotifications = async () => {
    if (isClient) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    const data = await fetchUserNotifications(role || 'Employee', user?.id);
    setNotifications(data);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadNotifications();
  }, [role, user]);

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;
    setMarkingAll(true);
    try {
      await markAllNotificationsAsRead(role || 'Employee', user?.id);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not mark all as read');
    } finally {
      setMarkingAll(false);
    }
  };

  const handleTestRingtone = async () => {
    await triggerDevicePushNotification({
      title: '🔔 Dayal CRM Alert',
      body: 'New client inquiry received with high priority.',
      delaySeconds: 1,
    });

    Alert.alert(
      'Notification Test',
      'Test alert triggered with device vibration feedback! Real-time alerts are connected to Supabase.',
      [{ text: 'OK' }]
    );
  };

  const handlePressItem = async (item: NotificationItem) => {
    // 1. Mark as read immediately in database & state
    if (!item.is_read) {
      setNotifications(prev =>
        prev.map(n => (n.id === item.id ? { ...n, is_read: true } : n))
      );
      await markNotificationAsRead(item.id);
    }

    // 2. Direct routing to relevant module
    const refId = item.reference_id;
    switch (item.module) {
      case 'lead':
        if (refId) {
          navigation.navigate('LeadDetails', { lead: { id: refId }, id: refId });
        } else {
          navigation.navigate('MainApp', { screen: 'Leads' });
        }
        break;

      case 'client':
        if (refId) {
          navigation.navigate('ClientDetails', { client: { id: refId }, id: refId });
        } else {
          navigation.navigate('MainApp', { screen: 'Clients' });
        }
        break;

      case 'project':
        if (refId) {
          navigation.navigate('ProjectDetails', { project: { id: refId }, id: refId });
        } else {
          navigation.navigate('MainApp', { screen: 'Projects' });
        }
        break;

      case 'service':
        if (refId) {
          navigation.navigate('ServiceDetails', { service: { id: refId }, id: refId });
        } else {
          navigation.navigate('ServicesList');
        }
        break;

      case 'task':
        if (refId) {
          navigation.navigate('TaskDetails', { id: refId });
        } else {
          navigation.navigate('Tasks');
        }
        break;

      case 'followup':
        navigation.navigate('FollowUps');
        break;

      case 'communication':
        if (refId) {
          navigation.navigate('LeadDetails', { lead: { id: refId }, id: refId });
        } else {
          navigation.navigate('FollowUps');
        }
        break;

      default:
        break;
    }
  };

  const getModuleIcon = (module: string) => {
    switch (module) {
      case 'lead':
        return <Users size={18} color="#2563EB" />;
      case 'client':
        return <UserCheck size={18} color="#059669" />;
      case 'project':
        return <Briefcase size={18} color="#7C3AED" />;
      case 'service':
        return <Layers size={18} color="#EA580C" />;
      case 'task':
        return <CheckSquare size={18} color="#D97706" />;
      case 'followup':
        return <Calendar size={18} color="#0284C7" />;
      case 'communication':
        return <PhoneCall size={18} color="#E11D48" />;
      default:
        return <Bell size={18} color="#4B5563" />;
    }
  };

  const getModuleBg = (module: string) => {
    switch (module) {
      case 'lead':
        return '#EFF6FF';
      case 'client':
        return '#ECFDF5';
      case 'project':
        return '#F5F3FF';
      case 'service':
        return '#FFF7ED';
      case 'task':
        return '#FEF3C7';
      case 'followup':
        return '#F0F9FF';
      case 'communication':
        return '#FFE4E6';
      default:
        return '#F3F4F6';
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <ArrowLeft color={Colors.text} size={22} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.counterBadge}>
              <Text style={styles.counterBadgeText}>{unreadCount} New</Text>
            </View>
          )}
        </View>

        {/* Mark All Read Button */}
        {unreadCount > 0 && !isClient && (
          <TouchableOpacity
            style={styles.markAllBtn}
            onPress={handleMarkAllRead}
            disabled={markingAll}
            activeOpacity={0.7}
          >
            {markingAll ? (
              <ActivityIndicator size="small" color="#2563EB" />
            ) : (
              <>
                <CheckCheck size={16} color="#2563EB" />
                <Text style={styles.markAllText}>Mark all read</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Test Outside App Ringtone Card */}
      {!isClient && (
        <View style={styles.testBannerWrap}>
          <TouchableOpacity style={styles.testBannerBtn} onPress={handleTestRingtone} activeOpacity={0.8}>
            <View style={styles.testBannerIconBox}>
              <Volume2 size={18} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.testBannerTitle}>Test Outside-App Push Notification</Text>
              <Text style={styles.testBannerSub}>Tap, minimize app & hear the ringtone & vibration</Text>
            </View>
            <Sparkles size={16} color="#059669" />
          </TouchableOpacity>
        </View>
      )}

      {isClient ? (
        <View style={styles.emptyContainer}>
          <AlertCircle color={Colors.textMuted} size={48} />
          <Text style={styles.emptyTitle}>No Notifications</Text>
          <Text style={styles.emptySubtitle}>You currently have no new notifications.</Text>
        </View>
      ) : loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loaderText}>Loading notifications...</Text>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Bell color={Colors.textMuted} size={48} />
          <Text style={styles.emptyTitle}>All Caught Up!</Text>
          <Text style={styles.emptySubtitle}>You don't have any staff notifications right now.</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => {
            const isUnread = !item.is_read;
            return (
              <TouchableOpacity
                style={[
                  styles.notificationCard,
                  isUnread ? styles.unreadCard : styles.seenCard,
                ]}
                onPress={() => handlePressItem(item)}
                activeOpacity={0.7}
              >
                {/* Module Avatar Icon */}
                <View style={[styles.iconBox, { backgroundColor: getModuleBg(item.module) }]}>
                  {getModuleIcon(item.module)}
                </View>

                {/* Content */}
                <View style={styles.contentBox}>
                  <View style={styles.titleRow}>
                    <View style={styles.titleWithDot}>
                      {isUnread && <View style={styles.unreadDot} />}
                      <Text style={[styles.itemTitle, isUnread && styles.unreadTitle]} numberOfLines={2}>
                        {item.title}
                      </Text>
                    </View>

                    {/* Seen / New State Indicator */}
                    {isUnread ? (
                      <View style={styles.newPill}>
                        <Text style={styles.newPillText}>NEW</Text>
                      </View>
                    ) : (
                      <View style={styles.seenBadge}>
                        <CheckCircle2 size={13} color="#16A34A" />
                        <Text style={styles.seenText}>Seen</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.itemMessage}>{item.message}</Text>

                  <View style={styles.footerRow}>
                    <View style={styles.timeWrap}>
                      <Clock size={12} color={Colors.textMuted} />
                      <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
                    </View>
                    {item.created_by_name && (
                      <Text style={styles.byText}>by {item.created_by_name}</Text>
                    )}
                    <View style={styles.moduleTag}>
                      <Text style={styles.moduleTagText}>{item.module.toUpperCase()}</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButton: {
    padding: 4,
    marginRight: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  counterBadge: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#93C5FD',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  counterBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  markAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  testBannerWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  testBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  testBannerIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
  },
  testBannerTitle: {
    fontSize: 12.5,
    fontWeight: 'bold',
    color: '#065F46',
  },
  testBannerSub: {
    fontSize: 11,
    color: '#047857',
    marginTop: 2,
  },
  listContainer: {
    padding: 16,
    gap: 10,
  },
  notificationCard: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 12,
    alignItems: 'flex-start',
    gap: 12,
  },
  unreadCard: {
    backgroundColor: '#EFF6FF', // Soft Blue Highlight
    borderColor: '#BFDBFE',
    borderWidth: 1.5,
    borderLeftWidth: 4,
    borderLeftColor: '#2563EB', // Vibrant Blue Indicator
  },
  seenCard: {
    backgroundColor: '#FFFFFF',
    borderColor: Colors.border,
    borderWidth: 1,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentBox: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  titleWithDot: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563EB',
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    flexShrink: 1,
  },
  unreadTitle: {
    fontWeight: '700',
    color: '#1E3A8A',
  },
  newPill: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  newPillText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  seenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  seenText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#16A34A',
  },
  itemMessage: {
    fontSize: 12.5,
    color: '#4B5563',
    lineHeight: 18,
    marginBottom: 8,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  byText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  moduleTag: {
    backgroundColor: Colors.background,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 'auto',
  },
  moduleTagText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  loaderText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.textMuted,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
});
