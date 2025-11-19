import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getUserData, removeToken } from "../lib/storage";

const SUBJECT_ROWS = [
  [{ label: "Mathematics" }, { label: "Science" }],
  [{ label: "History" }, { label: "Notifications" }],
  [{ label: "Language" }, { label: "Help & Support" }],
];

export default function ProfileScreen() {
  const router = useRouter();
  const [toggles, setToggles] = useState({
    auto: true,
    visual: true,
    audio: true,
  });
  const [userData, setUserData] = useState<{
    email?: string;
    fullName?: string;
    avatarUrl?: string | null;
    preferredLanguage?: string;
    learningStyle?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUserData = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getUserData();
      if (data) {
        setUserData(data);
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUserData();
    }, [loadUserData])
  );

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout? You will need to login again to access your account.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            try {
              // Clear authentication token and user data
              await removeToken();
              // Navigate to login screen
              router.replace("/login");
            } catch (error) {
              console.error("Error during logout:", error);
              Alert.alert("Error", "Failed to logout. Please try again.");
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <LinearGradient
      colors={["#F7FBFF", "#FFFFFF"]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.background}
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color="#0F172A" />
          </TouchableOpacity>

          {isLoading ? (
            <View style={styles.avatar}>
              <ActivityIndicator size="large" color="#FFFFFF" />
            </View>
          ) : userData?.avatarUrl ? (
            <View style={styles.avatarContainer}>
              <Image
                source={{ uri: userData.avatarUrl }}
                style={styles.avatarImage}
              />
            </View>
          ) : (
            <LinearGradient
              colors={["#1FC7B6", "#6366F1"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatar}
            >
              <MaterialCommunityIcons name="brain" size={72} color="#FFFFFF" />
            </LinearGradient>
          )}

          <View style={styles.profileInfo}>
            <Text style={styles.name}>
              {userData?.fullName || "User"}
            </Text>
            {userData?.email && (
              <Text style={styles.email}>{userData.email}</Text>
            )}
            <TouchableOpacity activeOpacity={0.8}>
              <Text style={styles.editProfile}>Edit Profile</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Learning Preferences</Text>
            <View style={styles.preferenceCard}>
              <View style={styles.preferenceRow}>
                <View style={styles.prefLabelGroup}>
                  <MaterialCommunityIcons name="atom" size={20} color="#1FC7B6" />
                  <Text style={styles.prefLabel}>Auto-adapt content</Text>
                </View>
                <Switch
                  value={toggles.auto}
                  onValueChange={(value) => setToggles((prev) => ({ ...prev, auto: value }))}
                  trackColor={{ false: "#E2E8F0", true: "#1FC7B6" }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.preferenceGrid}>
                <View style={[styles.preferenceColumn, styles.preferenceColumnLeft]}>
                  <View style={styles.prefLabelGroup}>
                    <View style={styles.prefIconLabel}>
                      <MaterialCommunityIcons name="eye-outline" size={20} color="#1FC7B6" />
                      <Text style={styles.prefLabel}>Visual mode priority</Text>
                    </View>
                    <Switch
                      value={toggles.visual}
                      onValueChange={(value) => setToggles((prev) => ({ ...prev, visual: value }))}
                      trackColor={{ false: "#E2E8F0", true: "#1FC7B6" }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                </View>
                <View style={styles.preferenceColumn}>
                  <View style={styles.prefLabelGroup}>
                    <View style={styles.prefIconLabel}>
                      <MaterialCommunityIcons name="headphones" size={20} color="#1FC7B6" />
                      <Text style={styles.prefLabel}>Audio speed 1.5x</Text>
                    </View>
                    <Switch
                      value={toggles.audio}
                      onValueChange={(value) => setToggles((prev) => ({ ...prev, audio: value }))}
                      trackColor={{ false: "#E2E8F0", true: "#1FC7B6" }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Subjects</Text>
            <View style={styles.listCard}>
              {SUBJECT_ROWS.map((row, rowIndex) => (
                <View
                  key={rowIndex}
                  style={[
                    styles.listGridRow,
                    rowIndex < SUBJECT_ROWS.length - 1 && styles.listGridRowDivider,
                  ]}
                >
                  {row.map((item, idx) => (
                    <TouchableOpacity key={item.label} style={styles.listGridItem} activeOpacity={0.85}>
                      <Text style={styles.listLabel}>{item.label}</Text>
                      <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>
          </View>

          {/* Account Information Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account Information</Text>
            <View style={styles.listCard}>
              {userData?.email && (
                <View style={styles.metaRow}>
                  <View style={styles.metaLabelGroup}>
                    <Ionicons name="mail-outline" size={18} color="#1FC7B6" />
                    <Text style={styles.listLabel}>Email</Text>
                  </View>
                  <Text style={styles.metaValue}>{userData.email}</Text>
                </View>
              )}
              {userData?.preferredLanguage && (
                <View style={styles.metaRow}>
                  <View style={styles.metaLabelGroup}>
                    <Ionicons name="language-outline" size={18} color="#1FC7B6" />
                    <Text style={styles.listLabel}>Preferred Language</Text>
                  </View>
                  <Text style={styles.metaValue}>{userData.preferredLanguage}</Text>
                </View>
              )}
              {userData?.learningStyle && (
                <View style={styles.metaRow}>
                  <View style={styles.metaLabelGroup}>
                    <MaterialCommunityIcons name="brain" size={18} color="#1FC7B6" />
                    <Text style={styles.listLabel}>Learning Style</Text>
                  </View>
                  <Text style={styles.metaValue}>{userData.learningStyle}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <View style={styles.listCard}>
              <View style={styles.metaRow}>
                <Text style={styles.listLabel}>App version</Text>
                <Text style={styles.metaValue}>1.2.5</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.listLabel}>Terms</Text>
                <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
              </View>
            </View>
          </View>

          <TouchableOpacity 
            style={styles.logoutButton} 
            activeOpacity={0.9}
            onPress={handleLogout}
          >
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 20,
    rowGap: 24,
  },
  backButton: {
    height: 44,
    width: 44,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#CBD5F5",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  avatar: {
    alignSelf: "center",
    height: 140,
    width: 140,
    borderRadius: 70,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#6366F1",
    shadowOpacity: 0.3,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  avatarContainer: {
    alignSelf: "center",
    height: 140,
    width: 140,
    borderRadius: 70,
    overflow: "hidden",
    shadowColor: "#6366F1",
    shadowOpacity: 0.3,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
    borderWidth: 4,
    borderColor: "#FFFFFF",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  profileInfo: {
    alignItems: "center",
    marginTop: 24,
  },
  name: {
    fontSize: 26,
    fontFamily: "Montserrat_600SemiBold",
    color: "#0F172A",
  },
  email: {
    marginTop: 4,
    fontSize: 14,
    fontFamily: "Roboto_400Regular",
    color: "#64748B",
  },
  editProfile: {
    marginTop: 12,
    fontSize: 13,
    fontFamily: "Roboto_500Medium",
    color: "#1FC7B6",
  },
  metaLabelGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  section: {
    marginTop: 28,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: "Montserrat_600SemiBold",
    color: "#1E293B",
    marginBottom: 14,
  },
  preferenceCard: {
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingVertical: 18,
    shadowColor: "#CBD5F5",
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  preferenceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  prefLabelGroup: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 12,
    flex: 1,
  },
  prefIconLabel: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
  },
  prefLabel: {
    fontSize: 15,
    fontFamily: "Roboto_500Medium",
    color: "#0F172A",
    flexShrink: 1,
    flexWrap: "nowrap",
  },
  preferenceGrid: {
    marginTop: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
    flexDirection: "column",
  },
  preferenceColumn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  preferenceColumnLeft: {
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  listCard: {
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 10,
    shadowColor: "#CBD5F5",
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  listGridRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "stretch",
    columnGap: 8,
    paddingVertical: 8,
  },
  listGridRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  listGridItem: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  listLabel: {
    fontSize: 15,
    fontFamily: "Roboto_500Medium",
    color: "#0F172A",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  metaValue: {
    fontSize: 15,
    fontFamily: "Roboto_400Regular",
    color: "#64748B",
  },
  logoutButton: {
    marginTop: 32,
    alignSelf: "center",
    width: "100%",
    backgroundColor: "#FB6A63",
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: "#FB6A63",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  logoutText: {
    fontSize: 18,
    fontFamily: "Montserrat_600SemiBold",
    color: "#FFFFFF",
  },
});
