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
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Bell,
  CheckCircle2,
  Clock,
  Briefcase,
  Layers,
  MessageSquare,
  CheckCheck,
  Sparkles,
} from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import {
  fetchClientNotifications,
  markNotificationAsRead,
  markAllClientNotificationsAsRead,
  startRealtimeNotificationListener,
  NotificationItem,
} from '../../lib/notificationService';

export default function ClientNotificationsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 20);
  const { user } = useAuth();
  const clientId = user?.clientId || user?.id;

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const loadNotifications = async () => {
    if (!clientId) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    const data = await fetchClientNotifications(clientId, user?.id);
    setNotifications(data);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadNotifications();
    const unsubscribe = startRealtimeNotificationListener('Client', user?.id, clientId, () => {
      loadNotifications();
    });
    return () => {
      unsubscribe();
    };
  }, [clientId, user?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;
    setMarkingAll(true);
    try {
      await markAllClientNotificationsAsRead(clientId, user?.id);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not mark all as read');
    } finally {
      setMarkingAll(false);
    }
  };

  const handlePressItem = async (item: NotificationItem) => {
    if (!item.is_read) {
      setNotifications(prev =>
        prev.map(n => (n.id === item.id ? { ...n, is_read: true } : n))
      );
      await markNotificationAsRead(item.id);
    }

    if (item.module === 'chat' || item.module === 'message') {
      navigation.navigate('Chat');
    } else {
      navigation.navigate('Project');
    }
  };

  const getModuleIcon = (module: string) => {
    switch (module) {
      case 'chat':
      case 'message':
        return <MessageSquare size={18} color="#2563EB" />;
      case 'project':
        return <Briefcase size={18} color="#16A34A" />;
      case 'service':
      case 'milestone':
        return <Layers size={18} color="#EA580C" />;
      default:
        return <Bell size={18} color={Colors.primaryDark} />;
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
    <SafeAreaView style={[styles.container, { paddingTop: safeTop }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Project Updates</Text>
          {unreadCount > 0 && (
            <View style={styles.counterBadge}>
              <Text style={styles.counterBadgeText}>{unreadCount} New</Text>
            </View>
          )}
        </View>

        {unreadCount > 0 && (
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

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading updates...</Text>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconBox}>
            <Bell size={28} color={Colors.primaryDark} />
          </View>
          <Text style={styles.emptyTitle}>You're All Caught Up!</Text>
          <Text style={styles.emptySub}>
            Whenever Dayal Construction updates your milestones, uploads 2D/3D drawings, or shares site photos, you will be notified here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={item => item.id}
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
                {/* Module Icon Box */}
                <View style={styles.iconBox}>
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
    backgroundColor: '#F8FAFC',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: Colors.textMuted,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: Colors.surface,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1.5,
    borderLeftWidth: 4,
    borderLeftColor: '#2563EB',
  },
  seenCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  emptyIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  emptySub: {
    fontSize: 12.5,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
});
