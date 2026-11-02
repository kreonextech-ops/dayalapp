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
  module: 'lead' | 'client' | 'project' | 'service' | 'task' | 'communication' | 'followup' | 'general' | 'chat' | 'message' | 'milestone';
  reference_id?: string;
  recipient_role: 'Admin' | 'Employee' | 'All_Staff' | 'Client';
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
 * Saves or updates the device push token in the user's record (inside permissions JSONB).
 * Supports Admin, Employees, and Clients so each device can receive push notifications.
 */
export async function syncUserPushToken(userId: string, userRole?: string) {
  if (!userId) return;
  try {
    const token = await registerForPushNotificationsAsync();
    if (token) {
      const { data: emp } = await supabase
        .from('employees')
        .select('permissions')
        .eq('id', userId)
        .maybeSingle();

      const currentPerms = emp?.permissions || {};
      if (currentPerms.push_token !== token) {
        await supabase
          .from('employees')
          .update({ permissions: { ...currentPerms, push_token: token } })
          .eq('id', userId);
      }
    }
  } catch (err) {
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
  module?: 'lead' | 'client' | 'project' | 'service' | 'task' | 'communication' | 'followup' | 'general' | 'chat';
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

    // 3. Dispatch Remote Push to recipient devices
    const targetTokens = new Set<string>();

    // A. Always notify Admins so Admin gets 100% of all CRM events
    const { data: adminList } = await supabase
      .from('employees')
      .select('permissions')
      .ilike('role', '%admin%');

    if (adminList) {
      for (const admin of adminList) {
        const tok = admin.permissions?.push_token;
        if (tok) targetTokens.add(tok);
      }
    }

    // B. Target specific employee if assigned
    if (recipientUserId) {
      const { data: recipientEmp } = await supabase
        .from('employees')
        .select('permissions')
        .eq('id', recipientUserId)
        .maybeSingle();

      const tok = recipientEmp?.permissions?.push_token;
      if (tok) targetTokens.add(tok);
    } else if (recipientRole === 'All_Staff') {
      // Broad push to all staff (excluding Client accounts)
      const { data: staffList } = await supabase
        .from('employees')
        .select('permissions')
        .neq('role', 'Client');

      if (staffList) {
        for (const staff of staffList) {
          const tok = staff.permissions?.push_token;
          if (tok) targetTokens.add(tok);
        }
      }
    }

    // C. Dispatch to all identified staff/admin tokens
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
 * Admin receives 100% of all notifications.
 * Employees receive assigned/All_Staff notifications.
 * Clients receive ONLY notifications targeted to their client record.
 */
export function startRealtimeNotificationListener(
  userRole: string,
  userId?: string,
  clientIdOrCallback?: string | ((notification: NotificationItem) => void),
  callback?: (notification: NotificationItem) => void
) {
  const clientId = typeof clientIdOrCallback === 'string' ? clientIdOrCallback : undefined;
  const onNotificationReceived =
    typeof clientIdOrCallback === 'function' ? clientIdOrCallback : callback;

  const isAdmin = userRole === 'Admin';
  const isClient = userRole === 'Client';

  const channel = supabase
    .channel(`realtime_device_notifs_${userId || 'guest'}`)
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

        if (isClient) {
          // Client ONLY receives notifications explicitly for their project/chat
          const isForThisClient =
            newNotif.recipient_role === 'Client' &&
            (newNotif.recipient_user_id === userId ||
              newNotif.recipient_user_id === clientId ||
              newNotif.reference_id === clientId);

          if (isForThisClient) {
            await triggerDevicePushNotification({
              title: newNotif.title,
              body: newNotif.message,
              data: { module: newNotif.module, referenceId: newNotif.reference_id },
            });
            if (onNotificationReceived) onNotificationReceived(newNotif);
          }
          return;
        }

        // Staff does NOT see other clients' private notifications unless Admin
        if (newNotif.recipient_role === 'Client' && !isAdmin) {
          return;
        }

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

/**
 * Creates and dispatches a notification specifically to a Client
 * (e.g. When Admin/Staff completes a milestone, posts an update, or uploads drawings)
 */
export async function createClientNotification({
  clientId,
  clientEmpId,
  title,
  message,
  module = 'milestone',
  referenceId,
  createdByName = 'Dayal Construction Team',
}: {
  clientId: string;
  clientEmpId?: string;
  title: string;
  message: string;
  module?: string;
  referenceId?: string;
  createdByName?: string;
}) {
  try {
    const targetUserId = clientEmpId || clientId;

    // 1. Insert in notifications table targeted strictly to this Client
    await supabase.from('notifications').insert([
      {
        title,
        message,
        module,
        reference_id: referenceId || clientId,
        recipient_role: 'Client',
        recipient_user_id: targetUserId,
        created_by_name: createdByName,
        is_read: false,
      },
    ]);

    // 2. Dispatch remote push if client device has a push token registered
    let targetPushToken: string | null = null;
    if (clientEmpId) {
      const { data: empRecord } = await supabase
        .from('employees')
        .select('permissions')
        .eq('id', clientEmpId)
        .maybeSingle();
      targetPushToken = empRecord?.permissions?.push_token || null;
    }

    if (!targetPushToken && clientId) {
      const { data: empRecord } = await supabase
        .from('employees')
        .select('permissions')
        .eq('department', clientId)
        .eq('role', 'Client')
        .limit(1)
        .maybeSingle();
      targetPushToken = empRecord?.permissions?.push_token || null;
    }

    if (targetPushToken) {
      await sendRemotePushNotification({
        toToken: targetPushToken,
        title,
        body: message,
        data: { module, referenceId: referenceId || clientId },
      });
    }
  } catch (err) {
    console.warn('Failed to create client notification:', err);
  }
}

/**
 * Fetches notifications specifically for a logged-in Client
 */
export async function fetchClientNotifications(clientId?: string, clientEmpId?: string) {
  try {
    let orConditions: string[] = [];
    if (clientEmpId) orConditions.push(`recipient_user_id.eq.${clientEmpId}`);
    if (clientId) orConditions.push(`recipient_user_id.eq.${clientId}`);
    if (clientId) orConditions.push(`reference_id.eq.${clientId}`);

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('recipient_role', 'Client')
      .order('created_at', { ascending: false })
      .limit(30);

    if (orConditions.length > 0) {
      query = query.or(orConditions.join(','));
    }

    const { data, error } = await query;
    if (error) {
      if (error.code === 'PGRST205') return [];
      throw error;
    }
    return (data || []) as NotificationItem[];
  } catch (err: any) {
    if (err?.code !== 'PGRST205') {
      console.warn('Fetch client notifications error:', err);
    }
    return [];
  }
}

/**
 * Marks all notifications for a Client as read
 */
export async function markAllClientNotificationsAsRead(clientId?: string, clientEmpId?: string) {
  try {
    let orConditions: string[] = [];
    if (clientEmpId) orConditions.push(`recipient_user_id.eq.${clientEmpId}`);
    if (clientId) orConditions.push(`recipient_user_id.eq.${clientId}`);
    if (clientId) orConditions.push(`reference_id.eq.${clientId}`);

    let query = supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_role', 'Client')
      .eq('is_read', false);

    if (orConditions.length > 0) {
      query = query.or(orConditions.join(','));
    }

    await query;
  } catch (err) {
    console.warn('Mark all client read error:', err);
  }
}
