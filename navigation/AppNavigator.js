import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import AuthStack from './AuthStack';
import MainNavigator from './MainNavigator';
import LoadingScreen from '../screens/LoadingScreen';
import AdminDashboard from '../screens/AdminDashboard';
import UserManagement from '../screens/UserManagement';
import ContentManagement from '../screens/ContentManagement';
import Reports from '../screens/Reports';

const Stack = createStackNavigator();

export default function AppNavigator() {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <Stack.Screen name="Auth" component={AuthStack} />
      ) : isAdmin ? (
        <>
          <Stack.Screen name="AdminDashboard" component={AdminDashboard} />
          <Stack.Screen name="UserManagement" component={UserManagement} />
          <Stack.Screen name="ContentManagement" component={ContentManagement} />
          <Stack.Screen name="Reports" component={Reports} />
        </>
      ) : (
        <Stack.Screen name="MainApp" component={MainNavigator} />
      )}
    </Stack.Navigator>
  );
}
