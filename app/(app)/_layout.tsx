// app/(app)/_layout.tsx
import { Tabs } from 'expo-router';
import { BarChart4, Home, NotebookText, Settings, User, Utensils } from 'lucide-react-native';
// Import 'useAuth' mới
import { useAuth } from '../../src/auth/AuthContext';

type TabConfig = {
  name: string;
  title: string;
  icon: React.ElementType; 
  href?: null;
  condition: boolean;      
};

export default function AppLayout() {
  // 'role' bây giờ đã ĐÚNG, lấy từ app_metadata
  const { role } = useAuth(); 

  const allTabs: TabConfig[] = [
    { name: "home", title: "Bàn", icon: Home, condition: true },
    { name: "order", title: "Order", icon: NotebookText, href: null, condition: true },
    // Logic này giờ sẽ chạy đúng, 'staff' !== 'admin' -> false
    { name: "menu", title: "Menu", icon: Utensils, condition: role === 'admin' },
    { name: "report", title: "Báo cáo", icon: BarChart4, condition: role === 'admin' },
    { name: "staff", title: "Nhân viên", icon: User, condition: role === 'admin' },
    { name: "settings", title: "Cài đặt", icon: Settings, condition: true }
  ];

  const visibleTabs = allTabs.filter(tab => tab.condition);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#FF6B35',
      }}
    >
      {visibleTabs.map(tab => {
        const Icon = tab.icon;
        return (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: tab.title,
              href: tab.href,
              tabBarIcon: ({ color }) => <Icon color={color} />,
            }}
          />
        );
      })}
    </Tabs>
  );
}