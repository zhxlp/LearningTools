import { Text, View, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

export default function Index() {
  const router = useRouter();

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
  ];

  return (
    <SafeAreaView style={styles.container}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    flex: 1,
    paddingHorizontal: 20,
  },
  appCard: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 20,
    margin: 10,
    width: 140,
    height: 140,
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
    fontSize: 48,
    marginBottom: 10,
  },
  appName: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
});
