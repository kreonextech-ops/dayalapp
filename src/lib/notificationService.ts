import { Platform, Vibration, Alert } from 'react-native';
import { supabase } from '../lib/supabase';

export interface NotificationItem {
  id: string;
  created_at: string;
  title: string;
  message: string;
  module: 'lead' | 'client' | 'project' | 'service' | 'task' | 'general';
  reference_id?: string;
  recipient_role: 'Admin' | 'Employee' | 'All_Staff';
  recipient_user_id?: string;
  is_read: boolean;
  created_by_name?: string;
}

/**
 * Configure notifications setup - safely compatible with Expo Go and standalone builds
 */
export async function setupSystemNotifications(): Promise<boolean> {
  return true;
}

/**
 * Triggers vibration and alert feedback on device when a notification arrives
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
  const executeNotification = () => {
    try {
      // Vibrate phone with distinctive pattern
      Vibration.vibrate([0, 500, 200, 500]);
    } catch (err) {
      console.warn('Vibration trigger error:', err);
    }
  };

  if (delaySeconds > 0) {
    setTimeout(executeNotification, delaySeconds * 1000);
  } else {
    executeNotification();
  }
}

/**
 * Creates an in-app notification targeted strictly to Admin & Employees (NEVER Clients)
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
  module?: 'lead' | 'client' | 'project' | 'service' | 'task' | 'general';
  referenceId?: string;
  recipientRole?: 'Admin' | 'Employee' | 'All_Staff';
  recipientUserId?: string;
  createdByName?: string;
}) {
  try {
    const { data, error } = await supabase.from('notifications').insert([
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

    if (error) {
      console.warn('Notification insert skipped or table not yet created:', error.message);
    }

    // Trigger immediate vibration feedback on device
    await triggerDevicePushNotification({
      title,
      body: message,
      data: { module, referenceId },
    });

    return data;
  } catch (err) {
    console.warn('Error creating notification:', err);
  }
}

/**
 * Starts a real-time listener on Supabase so when anyone creates a notification
 * (e.g. from the web CRM or another admin), this device receives it in real time
 */
export function startRealtimeNotificationListener(
  userRole: string,
  userId?: string,
  onNotificationReceived?: (notification: NotificationItem) => void
) {
  if (userRole === 'Client') return () => {};

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

        // Check if this notification is targeted to this user or role
        const roleMatches =
          newNotif.recipient_role === 'All_Staff' ||
          newNotif.recipient_role === userRole ||
          (userRole === 'Admin' && (newNotif.recipient_role === 'Employee' || newNotif.recipient_role === 'Admin'));

        const userMatches = !newNotif.recipient_user_id || newNotif.recipient_user_id === userId;

        if (roleMatches || userMatches) {
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
 */
export async function fetchUserNotifications(userRole: string, userId?: string) {
  try {
    let query = supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);

    if (userRole === 'Admin') {
      query = query.or(`recipient_role.eq.Admin,recipient_role.eq.All_Staff`);
    } else if (userRole === 'Employee' || userRole === 'CRO') {
      query = query.or(`recipient_role.eq.Employee,recipient_role.eq.All_Staff${userId ? `,recipient_user_id.eq.${userId}` : ''}`);
    } else {
      return [];
    }

    const { data, error } = await query;
    if (error) {
      if (error.code === 'PGRST205') {
        return [];
      }
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
