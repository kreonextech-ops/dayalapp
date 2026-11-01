import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { ArrowLeft, Bell, CheckCircle2, Clock, Users, Briefcase, FileText, CheckSquare, AlertCircle, Volume2, Sparkles } from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { fetchUserNotifications, markNotificationAsRead, triggerDevicePushNotification, NotificationItem } from '../../lib/notificationService';

export default function NotificationsScreen({ navigation }: any) {
  const { user, role, isClient } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
    if (!item.is_read) {
      await markNotificationAsRead(item.id);
      setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, is_read: true } : n));
    }

    // Navigate to respective module if applicable
    if (item.module === 'lead') {
      navigation.navigate('MainApp', { screen: 'Leads' });
    } else if (item.module === 'client') {
      navigation.navigate('MainApp', { screen: 'Clients' });
    } else if (item.module === 'project') {
      navigation.navigate('MainApp', { screen: 'Projects' });
    } else if (item.module === 'task') {
      if (item.reference_id) {
        navigation.navigate('TaskDetails', { id: item.reference_id });
      } else {
        navigation.navigate('MainApp', { screen: 'Tasks' });
      }
    }
  };

  const getModuleIcon = (module: string) => {
    switch (module) {
      case 'lead':
        return <Users size={20} color={Colors.primary} />;
      case 'client':
        return <Users size={20} color="#3B82F6" />;
      case 'project':
        return <Briefcase size={20} color="#8B5CF6" />;
      case 'task':
        return <CheckSquare size={20} color={Colors.warning} />;
      default:
        return <Bell size={20} color={Colors.primaryDark} />;
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft color={Colors.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Test Outside App Ringtone Card */}
      {!isClient && (
        <View style={styles.testBannerWrap}>
          <TouchableOpacity style={styles.testBannerBtn} onPress={handleTestRingtone} activeOpacity={0.8}>
            <View style={styles.testBannerIconBox}>
              <Volume2 size={20} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.testBannerTitle}>Test Outside-App Ringtone</Text>
              <Text style={styles.testBannerSub}>Tap, minimize app & hear the ringtone & banner ring</Text>
            </View>
            <Sparkles size={18} color="#059669" />
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
          <Text style={styles.emptySubtitle}>You don't have any new staff notifications right now.</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.notificationCard, !item.is_read && styles.unreadCard]}
              onPress={() => handlePressItem(item)}
              activeOpacity={0.7}
            >
              <View style={styles.iconBox}>{getModuleIcon(item.module)}</View>
              <View style={styles.contentBox}>
                <View style={styles.titleRow}>
                  <Text style={[styles.itemTitle, !item.is_read && styles.unreadTitle]}>{item.title}</Text>
                  {!item.is_read && <View style={styles.unreadDot} />}
                </View>
                <Text style={styles.itemMessage}>{item.message}</Text>
                <View style={styles.footerRow}>
                  <Clock size={12} color={Colors.textMuted} />
                  <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
                  {item.created_by_name && (
                    <Text style={styles.byText}>• by {item.created_by_name}</Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}
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
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
  },
  testBannerTitle: {
    fontSize: 13,
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
    gap: 12,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'flex-start',
    gap: 12,
  },
  unreadCard: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentBox: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  unreadTitle: {
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primaryDark,
    marginLeft: 6,
  },
  itemMessage: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 6,
  },
  footerRow: {
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
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loaderText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
