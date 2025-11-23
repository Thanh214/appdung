import React from 'react';
import { View } from 'react-native';
import { Appbar, List, Text, useTheme } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

export default function NotificationsScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const [items, setItems] = React.useState(route.params?.alarms ?? []);
  const onClear = route.params?.onClear;
  const relevantItems = React.useMemo(() => {
    if (!Array.isArray(items) || items.length === 0) return [];
    const filtered = items.filter((a: any) => {
      const title = (a?.title ?? '').toLowerCase();
      const body = (a?.body ?? '').toLowerCase();
      const mentionsRelay =
        title.includes('relay') || body.includes('relay') ||
        title.includes('quạt') || body.includes('quạt') ||
        title.includes('máy bơm') || body.includes('máy bơm') ||
        title.includes('bơm') || body.includes('bơm');
      if (mentionsRelay) return false;
      const mentionsTemp = title.includes('nhiệt độ') || body.includes('nhiệt độ') || title.includes('temperature') || body.includes('temperature');
      const mentionsSoil = title.includes('độ ẩm đất') || body.includes('độ ẩm đất') || title.includes('soil') || body.includes('soil');
      return mentionsTemp || mentionsSoil;
    });
    if (filtered.length === 0) return [];
    const latest = filtered.reduce((acc: any, cur: any) => {
      if (!acc) return cur;
      const accTs = typeof acc.ts === 'number' ? acc.ts : new Date(acc.ts).getTime();
      const curTs = typeof cur.ts === 'number' ? cur.ts : new Date(cur.ts).getTime();
      return curTs > accTs ? cur : acc;
    }, null as any);
    return latest ? [latest] : [];
  }, [items]);
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Thông báo" />
        <Appbar.Action icon="delete" onPress={() => { setItems([]); onClear && onClear(); }} />
      </Appbar.Header>
      <View style={{ padding: 12 }}>
        {relevantItems.length === 0 ? (
          <Text style={{ color: '#64748b' }}>Chưa có thông báo</Text>
        ) : (
          relevantItems.map((a, idx) => (
            <List.Item
              key={`${a.ts}-${idx}`}
              title={a.title}
              description={a.body}
              left={(p)=>(<List.Icon {...p} icon="bell" />)}
            />
          ))
        )}
      </View>
    </View>
  );
}


