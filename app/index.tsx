import { ActivityIndicator, View } from 'react-native';

export default function Index() {
  // Trang này chỉ hiển thị loading trong lúc chờ useAuthProtection điều hướng
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
      <ActivityIndicator size="large" color="#FF6B35" />
    </View>
  );
}