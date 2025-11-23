import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider as PaperProvider, MD3LightTheme } from 'react-native-paper';
import * as SecureStore from 'expo-secure-store';
import ActivationScreen from './src/screens/ActivationScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import ChartsScreen from './src/screens/ChartsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import { configureNotifications, requestNotificationPermission } from './src/services/notifications';
import { ActivationProvider, useActivation } from './src/contexts/ActivationContext';
export type RootStackParamList = {
  Activation: undefined;
  Dashboard: undefined;
  Charts: undefined;
  Settings: undefined;
  Notifications: { alarms: Array<{ title: string; body: string; ts: number }>; onClear?: () => void } | undefined;
};
const Stack = createNativeStackNavigator<RootStackParamList>();

function AppContent() {
  const { activated, checkActivation } = useActivation();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await configureNotifications();
        await requestNotificationPermission();
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    checkActivation();
  }, []);

  const theme = {
    ...MD3LightTheme,
    colors: {
      ...MD3LightTheme.colors,
      primary: '#16a34a',
      secondary: '#065f46',
      // Nền vàng nhạt, các ô dùng màu surface xanh lá nhạt
      background: '#fef9c3', // amber-100
      surface: '#ffffff', // white cards
    },
  };

  if (!isReady) return null;

  return (
    <PaperProvider theme={theme}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!activated ? (
            <Stack.Screen name="Activation">
              {(props) => (
                <ActivationScreen
                  {...props}
                  onActivated={() => checkActivation()}
                />
              )}
            </Stack.Screen>
          ) : (
            <>
              <Stack.Screen name="Dashboard" component={DashboardScreen} />
              <Stack.Screen name="Charts" component={ChartsScreen} />
              <Stack.Screen name="Settings" component={SettingsScreen} />
              <Stack.Screen name="Notifications" component={NotificationsScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
}

export default function App() {
  return (
    <ActivationProvider>
      <AppContent />
    </ActivationProvider>
  );
}