import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
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
            headerShown: true,
          }} 
        />
      </Stack>
    </>
  );
}
