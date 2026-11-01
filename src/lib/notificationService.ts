import { Platform, Vibration } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { supabase } from '../lib/supabase';

// Configure how notifications appear when the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface NotificationItem {
  id: string;
  created_at: string;
  title: string;
  message: string;
  module: 'lead' | 'client' | 'project' | 'service' | 'task' | 'communication' | 'followup' | 'general';
  reference_id?: string;
  recipient_role: 'Admin' | 'Employee' | 'All_Staff';
  recipient_user_id?: string;
  is_read: boolean;
  created_by_name?: string;
}

const EAS_PROJECT_ID = 'a4bc42f4-b45c-45f3-8d7d-9d0cf1dbfade';

/**
 * Requests push permissions and retrieves the Expo Push Token for the device.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token: string | null = null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563EB',
      sound: 'default',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Push notification permission not granted.');
      return null;
    }

    try {
      const pushTokenData = await Notifications.getExpoPushTokenAsync({
        projectId: EAS_PROJECT_ID,
      });
      token = pushTokenData.data;
    } catch (e) {
      console.warn('Error fetching Expo Push Token:', e);
    }
  } else {
    console.log('Push notifications require a physical device.');
  }

  return token;
}

/**
 * Configure notifications setup - safely compatible with Expo Go, iOS, and standalone builds
 */
export async function setupSystemNotifications(): Promise<boolean> {
  try {
    await registerForPushNotificationsAsync();
    return true;
  } catch (err) {
    console.warn('Notification setup error:', err);
    return false;
  }
}

/**
 * Saves or updates the device push token in the employee's record.
 * STRICTURE: Clients are NEVER registered for push notifications.
 */
export async function syncUserPushToken(userId: string, userRole?: string) {
  if (!userId || userRole === 'Client') return;
  try {
    const token = await registerForPushNotificationsAsync();
    if (token) {
      // Update push_token strictly in employees table (NEVER clients)
      await supabase
        .from('employees')
        .update({ push_token: token })
        .eq('id', userId);
    }
  } catch (err) {
    // Non-fatal if push_token column is not yet migrated in database
    console.log('Sync push token skipped:', err);
  }
}

/**
 * Triggers vibration and local device banner notification
 */
export async function triggerDevicePushNotification({
  title,
  body,
  data,
  delaySeconds = 0,
}: {
  title: string;
  body: string;
  data?: any;
  delaySeconds?: number;
}) {
  try {
    Vibration.vibrate([0, 300, 200, 300]);
    if (delaySeconds > 0) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: delaySeconds,
        },
      });
    } else {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: 'default',
        },
        trigger: null,
      });
    }
  } catch (err) {
    console.warn('Local notification trigger warning:', err);
  }
}

/**
 * Sends a real remote push notification to another user's device via Expo Push Gateway
 */
export async function sendRemotePushNotification({
  toToken,
  title,
  body,
  data,
}: {
  toToken: string;
  title: string;
  body: string;
  data?: any;
}) {
  if (!toToken || !toToken.startsWith('ExponentPushToken')) return;

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: toToken,
        sound: 'default',
        title,
        body,
        data,
        priority: 'high',
      }),
    });
  } catch (err) {
    console.warn('Failed sending remote push notification:', err);
  }
}

/**
 * Creates an in-app notification and dispatches remote push notifications to recipients
 */
export async function createNotification({
  title,
  message,
  module = 'general',
  referenceId,
  recipientRole = 'All_Staff',
  recipientUserId,
  createdByName,
}: {
  title: string;
  message: string;
  module?: 'lead' | 'client' | 'project' | 'service' | 'task' | 'communication' | 'followup' | 'general';
  referenceId?: string;
  recipientRole?: 'Admin' | 'Employee' | 'All_Staff';
  recipientUserId?: string;
  createdByName?: string;
}) {
  try {
    // 1. Insert in notifications table
    await supabase.from('notifications').insert([
      {
        title,
        message,
        module,
        reference_id: referenceId,
        recipient_role: recipientRole,
        recipient_user_id: recipientUserId,
        created_by_name: createdByName || 'System',
        is_read: false,
      },
    ]);

    // 2. Trigger local notification on sender's device for feedback
    await triggerDevicePushNotification({
      title,
      body: message,
      data: { module, referenceId },
    });

    // 3. Dispatch Remote Push to recipient devices (STRICTLY Staff & Admin, NEVER Clients)
    const targetTokens = new Set<string>();

    // A. Always notify Admins so Admin gets 100% of all CRM events
    const { data: adminList } = await supabase
      .from('employees')
      .select('push_token')
      .ilike('role', '%admin%')
      .not('push_token', 'is', null);

    if (adminList) {
      for (const admin of adminList) {
        if (admin.push_token) targetTokens.add(admin.push_token);
      }
    }

    // B. Target specific employee if assigned
    if (recipientUserId) {
      const { data: recipientEmp } = await supabase
        .from('employees')
        .select('push_token')
        .eq('id', recipientUserId)
        .maybeSingle();

      if (recipientEmp?.push_token) {
        targetTokens.add(recipientEmp.push_token);
      }
    } else if (recipientRole === 'All_Staff') {
      // Broad push to all staff
      const { data: staffList } = await supabase
        .from('employees')
        .select('push_token')
        .not('push_token', 'is', null);

      if (staffList) {
        for (const staff of staffList) {
          if (staff.push_token) targetTokens.add(staff.push_token);
        }
      }
    }

    // C. Dispatch to all identified staff/admin tokens (NEVER clients)
    for (const token of targetTokens) {
      await sendRemotePushNotification({
        toToken: token,
        title,
        body: message,
        data: { module, referenceId },
      });
    }
  } catch (err) {
    console.warn('Error creating notification:', err);
  }
}

/**
 * Real-time listener on Supabase notifications table
 * GUARANTEE: Clients receive 0 notifications. Admins receive 100% of all notifications.
 */
export function startRealtimeNotificationListener(
  userRole: string,
  userId?: string,
  onNotificationReceived?: (notification: NotificationItem) => void
) {
  // STRICT RULE: Clients NEVER receive any notifications
  if (userRole === 'Client') return () => {};

  const isAdmin = userRole === 'Admin';

  const channel = supabase
    .channel('realtime_device_notifications')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
      },
      async (payload) => {
        const newNotif = payload.new as NotificationItem;
        if (!newNotif) return;

        // Admin receives ALL notifications; employees receive All_Staff or their assigned ones
        const roleMatches =
          isAdmin ||
          newNotif.recipient_role === 'All_Staff' ||
          newNotif.recipient_role === userRole;

        const userMatches =
          isAdmin ||
          !newNotif.recipient_user_id ||
          newNotif.recipient_user_id === userId;

        if (roleMatches && userMatches) {
          await triggerDevicePushNotification({
            title: newNotif.title,
            body: newNotif.message,
            data: { module: newNotif.module, referenceId: newNotif.reference_id },
          });

          if (onNotificationReceived) {
            onNotificationReceived(newNotif);
          }
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Fetch notifications for current user role
 * GUARANTEE: Clients get empty list. Admin gets ALL company notifications.
 */
export async function fetchUserNotifications(userRole: string, userId?: string) {
  // STRICT RULE: Clients NEVER receive notifications
  if (userRole === 'Client') return [];

  try {
    let query = supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    // Admin receives ALL notifications across the company (no restrictive filter)
    if (userRole !== 'Admin') {
      query = query.or(
        `recipient_role.eq.Employee,recipient_role.eq.All_Staff${
          userId ? `,recipient_user_id.eq.${userId}` : ''
        }`
      );
    }

    const { data, error } = await query;
    if (error) {
      if (error.code === 'PGRST205') return [];
      throw error;
    }
    return (data || []) as NotificationItem[];
  } catch (err: any) {
    if (err?.code !== 'PGRST205') {
      console.warn('Fetch notifications error:', err);
    }
    return [];
  }
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(id: string) {
  try {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  } catch (err) {
    console.warn('Mark read error:', err);
  }
}

/**
 * Mark all visible unread notifications as read
 */
export async function markAllNotificationsAsRead(userRole: string, userId?: string) {
  if (userRole === 'Client') return;

  try {
    let query = supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
    if (userRole !== 'Admin') {
      query = query.or(
        `recipient_role.eq.Employee,recipient_role.eq.All_Staff${
          userId ? `,recipient_user_id.eq.${userId}` : ''
        }`
      );
    }
    await query;
  } catch (err) {
    console.warn('Mark all read error:', err);
  }
}
