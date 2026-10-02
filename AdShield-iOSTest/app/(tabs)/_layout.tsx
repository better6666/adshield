import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 10);
  const tabBarHeight = 58 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          paddingTop: 8,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          width: "100%",
          maxWidth: Platform.OS === "web" ? 560 : undefined,
          alignSelf: "center",
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "防护",
          tabBarIcon: ({ color }) => <IconSymbol size={25} name="shield.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="rules"
        options={{
          title: "规则",
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="slider.horizontal.3" color={color} />,
        }}
      />
      <Tabs.Screen
        name="safety"
        options={{
          title: "安全",
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="lock.shield" color={color} />,
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: "记录",
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="clock.arrow.circlepath" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "设置",
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="gearshape.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
