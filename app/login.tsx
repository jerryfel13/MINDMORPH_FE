import { useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");

  const handleSubmit = () => {
    if (!email.trim() || !password.trim()) {
      setFormError("Email and password are required.");
      return;
    }

    setFormError("");

    // TODO: Replace with authentication call
    router.push("/onboarding");
  };

  return (
    <LinearGradient colors={["#DDEBFF", "#F8FBFF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.background}>
      <SafeAreaView style={styles.safeArea}>
        <View pointerEvents="none" style={styles.decorLayer}>
          <LinearGradient
            colors={["rgba(33, 228, 185, 0.25)", "rgba(24, 144, 255, 0.12)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.decorBlob, styles.decorBlobTop]}
          />
          <LinearGradient
            colors={["rgba(24, 144, 255, 0.2)", "rgba(15, 23, 42, 0.1)"]}
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
              colors={["#FFFFFF", "rgba(221, 239, 255, 0.95)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCardGradient}
            >
              <View style={styles.heroBadgeRow}>
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>MindMorph</Text>
                </View>
                <Text style={styles.heroBadgeCaption}>Surface insights, track progress, stay motivated.</Text>
              </View>

              <View style={styles.heroBody}>
                <View style={styles.heroIconRing}>
                  <Ionicons name="planet" size={24} color="#0F172A" />
                </View>
                <View style={styles.heroTextBlock}>
                  <Text style={styles.heroTitle}>Welcome Back</Text>
                  <Text style={styles.heroSubtitle}>Log in to pick up where you left off and stay in flow.</Text>
                </View>
              </View>

              <View style={styles.heroDivider} />

              <View style={styles.heroPillRow}>
                <View style={styles.heroPill}>
                  <Ionicons name="time-outline" size={16} color="#0F172A" />
                  <Text style={styles.heroPillText}>Save progress</Text>
                </View>
                <View style={styles.heroPill}>
                  <Ionicons name="flash" size={16} color="#0F172A" />
                  <Text style={styles.heroPillText}>Instant insights</Text>
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
              <Text style={styles.sectionTitle}>Account Access</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Email <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="you@example.com"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Password <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                secureTextEntry
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
              />
            </View>

              <TouchableOpacity activeOpacity={0.85} onPress={() => router.push("/register")} style={styles.secondaryLink}>
                <Text style={styles.secondaryLinkText}>Need an account? Register</Text>
                <Ionicons name="arrow-forward" size={16} color="#2563EB" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {formError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{formError}</Text>
            </View>
          ) : null}

          <TouchableOpacity activeOpacity={0.9} style={styles.submitButton} onPress={handleSubmit}>
            <LinearGradient
              colors={["#1890FF", "#17C9B5"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.submitButtonGradient}
            >
              <Text style={styles.submitButtonText}>Log In</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Forgot password?</Text>
            <TouchableOpacity activeOpacity={0.85}>
              <Text style={styles.footerLink}>Reset it</Text>
            </TouchableOpacity>
          </View>
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
    height: 200,
    width: 200,
    borderRadius: 100,
  },
  decorBlobTop: {
    top: -50,
    left: -40,
  },
  decorBlobBottom: {
    bottom: -70,
    right: -50,
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
    shadowColor: "#1E88E5",
    shadowOpacity: 0.18,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 18 },
    borderWidth: 1,
    borderColor: "rgba(24,144,255,0.25)",
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
    backgroundColor: "rgba(24,144,255,0.16)",
  },
  heroBadgeText: {
    fontFamily: "Roboto_500Medium",
    fontSize: 12,
    color: "#0F172A",
    letterSpacing: 0.3,
  },
  heroBadgeCaption: {
    flex: 1,
    fontFamily: "Roboto_400Regular",
    fontSize: 12,
    color: "#0F172A",
    opacity: 0.7,
    textAlign: "right",
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
    backgroundColor: "rgba(24,144,255,0.18)",
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
  heroDivider: {
    height: 1,
    backgroundColor: "rgba(15, 23, 42, 0.06)",
  },
  heroPillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },
  heroPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: "rgba(24,144,255,0.35)",
  },
  heroPillText: {
    fontFamily: "Roboto_500Medium",
    fontSize: 12,
    color: "#0F172A",
  },
  section: {
    borderRadius: 28,
    padding: 22,
    shadowColor: "#60A5FA",
    shadowOpacity: 0.18,
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
  secondaryLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingTop: 4,
  },
  secondaryLinkText: {
    fontFamily: "Roboto_500Medium",
    fontSize: 13,
    color: "#2563EB",
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
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  footerText: {
    fontSize: 14,
    fontFamily: "Roboto_400Regular",
    color: "#475569",
  },
  footerLink: {
    fontSize: 14,
    fontFamily: "Roboto_500Medium",
    color: "#1890FF",
  },
});


