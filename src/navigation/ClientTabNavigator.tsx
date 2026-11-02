import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Briefcase, MessageSquare, Bell, User } from 'lucide-react-native';
import { Colors } from '../constants/Colors';

import ClientDashboardScreen from '../screens/client/ClientDashboardScreen';
import ClientChatScreen from '../screens/client/ClientChatScreen';
import ClientNotificationsScreen from '../screens/client/ClientNotificationsScreen';
import ClientProfileScreen from '../screens/client/ClientProfileScreen';

const Tab = createBottomTabNavigator();

export default function ClientTabNavigator() {
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom > 0 ? insets.bottom : (Platform.OS === 'android' ? 14 : 10);
  const bottomPadding = Math.max(bottomInset, 14);
  const totalBarHeight = 62 + bottomPadding;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopWidth: 1,
          borderTopColor: '#E2E8F0',
          height: totalBarHeight,
          paddingBottom: bottomPadding,
          paddingTop: 6,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.08,
          shadowRadius: 6,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      <Tab.Screen
        name="Project"
        component={ClientDashboardScreen}
        options={{
          tabBarLabel: 'My Project',
          tabBarIcon: ({ color }) => <Briefcase color={color} size={20} />,
        }}
      />
      <Tab.Screen
        name="Chat"
        component={ClientChatScreen}
        options={{
          tabBarLabel: 'Chat',
          tabBarIcon: ({ color }) => <MessageSquare color={color} size={20} />,
        }}
      />
      <Tab.Screen
        name="Updates"
        component={ClientNotificationsScreen}
        options={{
          tabBarLabel: 'Updates',
          tabBarIcon: ({ color }) => <Bell color={color} size={20} />,
        }}
      />
      <Tab.Screen
        name="Account"
        component={ClientProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }) => <User color={color} size={20} />,
        }}
      />
    </Tab.Navigator>
  );
}
