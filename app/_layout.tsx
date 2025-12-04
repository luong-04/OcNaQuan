// SỬA: Thêm dòng này lên ĐẦU TIÊN
import 'react-native-url-polyfill/auto';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, router, useRootNavigationState, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
// BỎ: 'react-native-url-polyfill/auto' ở đây nếu có

import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '../src/auth/AuthContext';

SplashScreen.preventAutoHideAsync();
const queryClient = new QueryClient();

// Hook bảo vệ
const useAuthProtection = () => {
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  
  const { session, isLoading } = useAuth(); 
  const inAuthGroup = segments[0] === '(auth)';

  useEffect(() => {
    if (isLoading || !navigationState?.key) return; 
    
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    }
    if (session && inAuthGroup) {
      router.replace('/(app)/home');
    }
  }, [session, isLoading, inAuthGroup, navigationState?.key]);
};

// Layout chính
function RootLayoutNav() {
  const [fontsLoaded, fontError] = useFonts({
    'SVN-Bold': require('../assets/fonts/SVN-Times New Roman Bold.ttf'),
  });

  const { isLoading: isAuthLoading } = useAuth();
  useAuthProtection(); 

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (isAuthLoading || (!fontsLoaded && !fontError)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(app)" />
      <Stack.Screen name="(auth)" />
    </Stack>
  );
}

// Bọc mọi thứ trong Provider
export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider> 
        <RootLayoutNav />
      </AuthProvider>
    </QueryClientProvider>
  );
}