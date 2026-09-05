import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { initialWindowMetrics, SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <StatusBar style="dark" />
      <Stack 
        screenOptions={{
          headerStyle: {
            backgroundColor: '#f5f5f5',
          },
          headerTintColor: '#000',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen 
          name="index" 
          options={{ 
            title: '学习工具',
            headerShown: true,
          }} 
        />
        <Stack.Screen 
          name="letter-cards/index" 
          options={{ 
            title: '字母卡片',
            headerShown: true,
          }} 
        />
        <Stack.Screen 
          name="letter-listening/index" 
          options={{ 
            title: '字母听力测试',
            headerShown: false,
          }} 
        />
        <Stack.Screen
          name="letter-listening/report"
          options={{
            title: '学习报表',
            headerShown: true,
          }}
        />
        <Stack.Screen
          name="math-test/index"
          options={{
            title: '计算测试',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            title: '全局设置',
            headerShown: true,
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
