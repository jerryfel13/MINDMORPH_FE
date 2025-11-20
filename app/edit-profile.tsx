import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert,
} from "react-native";

import { updateProfile as updateProfileAPI } from "@/lib/api";
import { getToken, getUserData, storeUserData } from "@/lib/storage";

export default function EditProfileScreen() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [formError, setFormError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Load current user data
  useEffect(() => {
    const loadUserData = async () => {
      try {
        setIsLoadingData(true);
        const userData = await getUserData();
        if (userData) {
          setFirstName(userData.first_name || "");
          setMiddleName(userData.middle_name || "");
          setLastName(userData.last_name || "");
          setAvatarUrl(userData.avatarUrl || "");
        }
      } catch (error) {
        console.error("Error loading user data:", error);
        setFormError("Failed to load profile data.");
      } finally {
        setIsLoadingData(false);
      }
    };

    loadUserData();
  }, []);

  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setFormError("First name and last name are required.");
      return;
    }

    setFormError("");
    setIsLoading(true);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Authentication token not found. Please log in again.");
      }

      // Update profile on server
      const updateData: any = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      };

      if (middleName.trim()) {
        updateData.middle_name = middleName.trim();
      } else {
        updateData.middle_name = null;
      }

      if (avatarUrl.trim()) {
        updateData.avatar_url = avatarUrl.trim();
      } else {
        updateData.avatar_url = null;
      }

      await updateProfileAPI(token, updateData);

      // Update local storage
      const currentUserData = await getUserData();
      await storeUserData({
        ...currentUserData,
        first_name: firstName.trim(),
        middle_name: middleName.trim() || null,
        last_name: lastName.trim(),
        avatarUrl: avatarUrl.trim() || null,
      });

      Alert.alert("Success", "Profile updated successfully!", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      const errorMessage = error.message || "Failed to update profile. Please try again.";

      let userMessage = errorMessage;
      if (errorMessage.includes("Cannot connect to server")) {
        userMessage = "Cannot connect to server. Please check your connection.";
      } else if (errorMessage.includes("Authentication")) {
        userMessage = "Session expired. Please log in again.";
        setTimeout(() => {
          router.replace("/login");
        }, 2000);
      }

      setFormError(userMessage);
      setTimeout(() => setFormError(""), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingData) {
    return (
      <LinearGradient colors={["#D9F4FF", "#F8FBFF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.background}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1890FF" />
            <Text style={styles.loadingText}>Loading profile...</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={["#D9F4FF", "#F8FBFF"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.background}
    >
      <SafeAreaView style={styles.safeArea}>
        <View pointerEvents="none" style={styles.decorLayer}>
          <LinearGradient
            colors={["rgba(33, 228, 185, 0.28)", "rgba(24, 144, 255, 0.12)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.decorBlob, styles.decorBlobTop]}
          />
          <LinearGradient
            colors={["rgba(24, 144, 255, 0.18)", "rgba(15, 23, 42, 0.08)"]}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[styles.decorBlob, styles.decorBlobBottom]}
          />
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8} style={styles.backButton}>
              <Ionicons name="chevron-back" size={22} color="#0F172A" />
            </TouchableOpacity>
            <LinearGradient
              colors={["#FFFFFF", "rgba(213, 251, 245, 0.95)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCardGradient}
            >
              <View style={styles.heroBadgeRow}>
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>Edit Profile</Text>
                </View>
              </View>

              <View style={styles.heroBody}>
                <View style={styles.heroIconRing}>
                  <Ionicons name="person" size={24} color="#0F172A" />
                </View>
                <View style={styles.heroTextBlock}>
                  <Text style={styles.heroTitle}>Update Your Profile</Text>
                  <Text style={styles.heroSubtitle}>
                    Keep your information up to date for a better learning experience.
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          <LinearGradient
            colors={["rgba(255, 255, 255, 0.97)", "rgba(255, 255, 255, 0.85)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.section}
          >
            <View style={styles.sectionContent}>
              <Text style={styles.sectionTitle}>Personal Information</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  First Name <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Taylor"
                  value={firstName}
                  onChangeText={setFirstName}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Middle Name</Text>
                <TextInput style={styles.input} placeholder="R." value={middleName} onChangeText={setMiddleName} />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  Last Name <Text style={styles.required}>*</Text>
                </Text>
                <TextInput style={styles.input} placeholder="Adams" value={lastName} onChangeText={setLastName} />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Avatar URL</Text>
                <TextInput
                  style={styles.input}
                  placeholder="https://example.com/avatar.png"
                  autoCapitalize="none"
                  value={avatarUrl}
                  onChangeText={setAvatarUrl}
                />
              </View>
            </View>
          </LinearGradient>

          {formError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{formError}</Text>
            </View>
          ) : null}

          <TouchableOpacity activeOpacity={0.9} style={styles.submitButton} onPress={handleSubmit} disabled={isLoading}>
            <LinearGradient
              colors={["#1890FF", "#17C9B5"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.submitButtonGradient}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>Save Changes</Text>
              )}
            </LinearGradient>
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
  decorLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  decorBlob: {
    position: "absolute",
    height: 220,
    width: 220,
    borderRadius: 110,
  },
  decorBlobTop: {
    top: -60,
    right: -40,
  },
  decorBlobBottom: {
    bottom: -80,
    left: -60,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 48,
    gap: 28,
    zIndex: 1,
  },
  header: {
    marginTop: 12,
    gap: 16,
  },
  backButton: {
    height: 40,
    width: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#94A3B8",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    alignSelf: "flex-start",
  },
  heroCardGradient: {
    borderRadius: 32,
    paddingVertical: 26,
    paddingHorizontal: 24,
    gap: 18,
    shadowColor: "#38BDF8",
    shadowOpacity: 0.18,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 18 },
    borderWidth: 1,
    borderColor: "rgba(31,199,182,0.25)",
  },
  heroBadgeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  heroBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(31,199,182,0.16)",
  },
  heroBadgeText: {
    fontFamily: "Roboto_500Medium",
    fontSize: 12,
    color: "#0F172A",
    letterSpacing: 0.3,
  },
  heroBody: {
    flexDirection: "row",
    gap: 16,
    alignItems: "flex-start",
  },
  heroIconRing: {
    height: 48,
    width: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(24,144,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(24,144,255,0.45)",
  },
  heroTextBlock: {
    flex: 1,
    gap: 8,
  },
  heroTitle: {
    fontSize: 30,
    lineHeight: 36,
    color: "#0F172A",
    fontFamily: "Montserrat_700Bold",
  },
  heroSubtitle: {
    fontFamily: "Roboto_400Regular",
    color: "#0F172A",
    opacity: 0.75,
    fontSize: 15,
    lineHeight: 22,
  },
  section: {
    borderRadius: 28,
    padding: 22,
    shadowColor: "#60A5FA",
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
  },
  sectionContent: {
    gap: 18,
  },
  sectionTitle: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 18,
    color: "#0F172A",
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontFamily: "Roboto_500Medium",
    color: "#334155",
  },
  required: {
    color: "#EF4444",
  },
  input: {
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    fontFamily: "Roboto_400Regular",
    color: "#0F172A",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)",
  },
  errorBanner: {
    backgroundColor: "rgba(239,68,68,0.12)",
    borderColor: "rgba(239,68,68,0.35)",
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  errorText: {
    fontFamily: "Roboto_500Medium",
    fontSize: 13,
    color: "#B91C1C",
    textAlign: "center",
  },
  submitButton: {
    borderRadius: 999,
    shadowColor: "#1890FF",
    shadowOpacity: 0.3,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    overflow: "hidden",
  },
  submitButtonGradient: {
    borderRadius: 999,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonText: {
    fontSize: 18,
    fontFamily: "Montserrat_600SemiBold",
    color: "#FFFFFF",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: "Roboto_400Regular",
    color: "#64748B",
  },
});

