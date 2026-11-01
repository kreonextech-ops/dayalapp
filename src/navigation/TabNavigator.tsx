import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Users, UserSquare2, Briefcase, Layers, CheckSquare, User } from 'lucide-react-native';
import { Colors } from '../constants/Colors';

import HomeScreen from '../screens/main/HomeScreen';
import LeadsScreen from '../screens/main/LeadsScreen';
import ClientsScreen from '../screens/main/ClientsScreen';
import ProjectsScreen from '../screens/main/ProjectsScreen';
import ServicesScreen from '../screens/main/ServicesScreen';
import TasksScreen from '../screens/main/TasksScreen';
import ProfileScreen from '../screens/main/ProfileScreen';

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
  const insets = useSafeAreaInsets();
  
  // Generous bottom clearance so text is NEVER cut off by Android gesture bars or navigation bars
  const bottomInset = insets.bottom > 0 ? insets.bottom : (Platform.OS === 'android' ? 14 : 10);
  const bottomPadding = Math.max(bottomInset, 14);
  const totalBarHeight = 62 + bottomPadding;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primaryDark,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
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
          paddingHorizontal: 0,
        },
        tabBarLabelStyle: {
          fontSize: 9.5,
          fontWeight: '600',
          letterSpacing: -0.2,
          marginTop: 2,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color }) => <Home color={color} size={20} />,
        }}
      />
      <Tab.Screen
        name="Leads"
        component={LeadsScreen}
        options={{
          tabBarLabel: 'Leads',
          tabBarIcon: ({ color }) => <Users color={color} size={20} />,
        }}
      />
      <Tab.Screen
        name="Clients"
        component={ClientsScreen}
        options={{
          tabBarLabel: 'Clients',
          tabBarIcon: ({ color }) => <UserSquare2 color={color} size={20} />,
        }}
      />
      <Tab.Screen
        name="Projects"
        component={ProjectsScreen}
        options={{
          tabBarLabel: 'Projects',
          tabBarIcon: ({ color }) => <Briefcase color={color} size={20} />,
        }}
      />
      <Tab.Screen
        name="Services"
        component={ServicesScreen}
        options={{
          tabBarLabel: 'Services',
          tabBarIcon: ({ color }) => <Layers color={color} size={20} />,
        }}
      />
      <Tab.Screen
        name="Tasks"
        component={TasksScreen}
        options={{
          tabBarLabel: 'Tasks',
          tabBarIcon: ({ color }) => <CheckSquare color={color} size={20} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }) => <User color={color} size={20} />,
        }}
      />
    </Tab.Navigator>
  );
}
