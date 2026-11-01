import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginSelectionScreen from '../screens/auth/LoginSelectionScreen';
import EmployeeLoginScreen from '../screens/auth/EmployeeLoginScreen';
import ClientLoginScreen from '../screens/auth/ClientLoginScreen';
import TabNavigator from './TabNavigator';

// Forms and Details
import LeadsScreen from '../screens/main/LeadsScreen';
import LeadDetailsScreen from '../screens/main/LeadDetailsScreen';
import NewLeadScreen from '../screens/main/NewLeadScreen';
import ClientsScreen from '../screens/main/ClientsScreen';
import NewClientScreen from '../screens/main/NewClientScreen';
import ClientDetailsScreen from '../screens/main/ClientDetailsScreen';
import ProjectsScreen from '../screens/main/ProjectsScreen';
import NewProjectScreen from '../screens/main/NewProjectScreen';
import ProjectDetailsScreen from '../screens/main/ProjectDetailsScreen';
import ServicesScreen from '../screens/main/ServicesScreen';
import NewServiceScreen from '../screens/main/NewServiceScreen';
import ServiceDetailsScreen from '../screens/main/ServiceDetailsScreen';
import FollowUpsScreen from '../screens/main/FollowUpsScreen';
import FinanceScreen from '../screens/main/FinanceScreen';
import NotificationsScreen from '../screens/main/NotificationsScreen';
import TasksScreen from '../screens/main/TasksScreen';
import TaskDetailsScreen from '../screens/main/TaskDetailsScreen';
import AuditLogsScreen from '../screens/main/AuditLogsScreen';
import EmployeesScreen from '../screens/main/EmployeesScreen';
import EmployeeDetailsScreen from '../screens/main/EmployeeDetailsScreen';
import ClientLoginsScreen from '../screens/main/ClientLoginsScreen';
import AssignmentsScreen from '../screens/main/AssignmentsScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {/* Auth Stack */}
        <Stack.Screen name="LoginSelection" component={LoginSelectionScreen} />
        <Stack.Screen name="EmployeeLogin" component={EmployeeLoginScreen} />
        <Stack.Screen name="ClientLogin" component={ClientLoginScreen} />
        
        {/* Main App */}
        <Stack.Screen name="MainApp" component={TabNavigator} />
        
        {/* Leads */}
        <Stack.Screen name="LeadDetails" component={LeadDetailsScreen} />
        <Stack.Screen name="NewLead" component={NewLeadScreen} />

        {/* Clients */}
        <Stack.Screen name="ClientDetails" component={ClientDetailsScreen} />
        <Stack.Screen name="NewClient" component={NewClientScreen} />

        {/* Projects */}
        <Stack.Screen name="ProjectDetails" component={ProjectDetailsScreen} />
        <Stack.Screen name="NewProject" component={NewProjectScreen} />

        {/* Services */}
        <Stack.Screen name="ServicesList" component={ServicesScreen} />
        <Stack.Screen name="ServiceDetails" component={ServiceDetailsScreen} />
        <Stack.Screen name="NewService" component={NewServiceScreen} />

        {/* CRM Modules */}
        <Stack.Screen name="Assignments" component={AssignmentsScreen} />
        <Stack.Screen name="FollowUps" component={FollowUpsScreen} />
        <Stack.Screen name="Finance" component={FinanceScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="Tasks" component={TasksScreen} />
        <Stack.Screen name="TaskDetails" component={TaskDetailsScreen} />
        <Stack.Screen name="AuditLogs" component={AuditLogsScreen} />
        <Stack.Screen name="Employees" component={EmployeesScreen} />
        <Stack.Screen name="EmployeeDetails" component={EmployeeDetailsScreen} />
        <Stack.Screen name="ClientLogins" component={ClientLoginsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
