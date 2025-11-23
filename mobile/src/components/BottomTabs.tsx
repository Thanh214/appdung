import React from 'react';
import { BottomNavigation, useTheme } from 'react-native-paper';

type TabKey = 'Dashboard' | 'Charts' | 'Settings';

type Props = {
  current: TabKey;
  onNavigate: (key: TabKey) => void;
};

export default function BottomTabs({ current, onNavigate }: Props) {
  const theme = useTheme();
  const getIndex = () => {
    switch (current) {
      case 'Dashboard': return 0;
      case 'Charts': return 1;
      case 'Settings': return 2;
      default: return 0;
    }
  };
  
  const routes = [
    { key: 'Dashboard', title: 'Trang chủ', focusedIcon: 'home', unfocusedIcon: 'home-outline' },
    { key: 'Charts', title: 'Biểu đồ', focusedIcon: 'chart-line', unfocusedIcon: 'chart-line-variant' },
    { key: 'Settings', title: 'Cài đặt', focusedIcon: 'cog', unfocusedIcon: 'cog-outline' },
  ];
  return (
    <BottomNavigation.Bar
      navigationState={{ index: getIndex(), routes }}
      onTabPress={({ route }) => {
        const key = route.key as TabKey;
        if (key !== current) onNavigate(key);
      }}
      activeColor={theme.colors.primary}
      inactiveColor="#6b7280"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#ffffff' }}
    />
  );
}


