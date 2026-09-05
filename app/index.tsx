import { Text, View, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { MaterialIcons } from '@expo/vector-icons';
import ParentalGateOverlay from "../components/ParentalGateOverlay";

export default function Index() {
  const router = useRouter();
  const [gateVisible, setGateVisible] = useState(false);

  const apps = [
    {
      id: "letter-cards",
      name: "字母卡片",
      icon: "📝",
    },
    {
      id: "letter-listening",
      name: "字母听力测试",
      icon: "🎧",
    },
    {
      id: "math-test",
      name: "计算测试",
      icon: "🧮",
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      {/* 右上角 header 的设置入口：需先过家长验证再进入全局设置 */}
      <Stack.Screen
        options={{
          headerRight: () => (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setGateVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="全局设置"
            >
              <MaterialIcons name="settings" size={24} color="#1976d2" />
            </TouchableOpacity>
          ),
        }}
      />

      <View style={styles.grid}>
        {apps.map((app) => (
          <TouchableOpacity
            key={app.id}
            style={styles.appCard}
            onPress={() => router.push(`/${app.id}`)}
          >
            <Text style={styles.icon}>{app.icon}</Text>
            <Text style={styles.appName}>{app.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ParentalGateOverlay
        visible={gateVisible}
        onClose={() => setGateVisible(false)}
        onSuccess={() => {
          setGateVisible(false);
          router.push('/settings');
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  headerButton: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    flex: 1,
    paddingHorizontal: 16,
  },
  appCard: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 16,
    margin: 8,
    width: 130,
    height: 130,
    justifyContent: "center",
    alignItems: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  icon: {
    fontSize: 42,
    marginBottom: 8,
  },
  appName: {
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
});
