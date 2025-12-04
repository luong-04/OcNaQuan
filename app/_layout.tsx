// app/_layout.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack, router, useRootNavigationState, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-url-polyfill/auto';
import { AuthProvider, useAuth } from '../src/auth/AuthContext';

SplashScreen.preventAutoHideAsync();
const queryClient = new QueryClient();

// --- HOOK BẢO VỆ (CODE MỚI ĐÃ SỬA) ---
const useAuthProtection = () => {
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  
  const { session, isLoading } = useAuth(); 

  // Kiểm tra xem đang ở nhóm nào
  const inAuthGroup = segments[0] === '(auth)';
  const inAppGroup = segments[0] === '(app)';

  useEffect(() => {
    // Chờ navigation load xong mới xử lý
    if (isLoading || !navigationState?.key) return; 
    
    // 1. Nếu chưa đăng nhập và KHÔNG ở trang Login -> Đá về Login
    if (!session && !inAuthGroup) {
      // Dùng replace để không back lại được
      router.replace('/(auth)/login');
    }

    // 2. Nếu đã đăng nhập và KHÔNG ở trong App -> Vào Home
    if (session && !inAppGroup) {
      router.replace('/(app)/home');
    }
  }, [session, isLoading, inAuthGroup, inAppGroup, navigationState?.key]);
};
// -------------------------------------

function RootLayoutNav() {
  const [fontsLoaded, fontError] = useFonts({
    'SVN-Bold': require('../assets/fonts/SVN-Times New Roman Bold.ttf'),
  });

  const { isLoading: isAuthLoading } = useAuth();
  
  // Gọi hook bảo vệ
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
      {/* SỬA: Chỉ cần khai báo tên, không cần options gây lỗi */}
      <Stack.Screen name="index" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider> 
        <RootLayoutNav />
      </AuthProvider>
    </QueryClientProvider>
  );
}