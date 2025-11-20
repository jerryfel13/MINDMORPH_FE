import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, Router, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSubjectProgress } from "../hooks/use-subject-progress";
import { getUserData } from "../lib/storage";
import { getUserSubjects, getArchivedSubjects, archiveSubject, unarchiveSubject, Subject } from "../lib/subjects-service";

// Subject Progress Card Component
function SubjectProgressCard({ 
  subject, 
  router, 
  onArchive, 
  isArchived = false,
  showArchiveButton = true,
  onProgressUpdate
}: { 
  subject: Subject & { progress?: number }; 
  router: Router;
  onArchive?: () => void;
  isArchived?: boolean;
  showArchiveButton?: boolean;
  onProgressUpdate?: (subjectId: string, progress: number) => void;
}) {
  const { progress, loading } = useSubjectProgress(subject.id);

  // Notify parent when progress updates
  useEffect(() => {
    if (!loading && progress !== undefined && onProgressUpdate) {
      onProgressUpdate(subject.id, progress);
    }
  }, [progress, loading, subject.id, onProgressUpdate]);

  return (
    <LinearGradient
      colors={subject.colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardIconWrapper}>
          <MaterialCommunityIcons name={subject.icon as never} size={28} color="#FFFFFF" />
        </View>
        {showArchiveButton && onArchive && (
          <TouchableOpacity
            style={styles.archiveButton}
            onPress={onArchive}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons 
              name={isArchived ? "archive-arrow-up" : "archive"} 
              size={18} 
              color="#FFFFFF" 
            />
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.cardTitle}>{subject.name}</Text>
      <View style={styles.progressWrapper}>
        <View style={styles.progressOuter}>
          <View style={styles.progressInner}>
            {loading ? (
              <ActivityIndicator size="small" color="#0F172A" />
            ) : (
              <Text style={styles.progressValue}>{progress || 0}%</Text>
            )}
          </View>
        </View>
      </View>
      {!isArchived && (
        <TouchableOpacity
          style={styles.cardButton}
          activeOpacity={0.85}
          onPress={() =>
            router.push({ 
              pathname: "/subject-overview", 
              params: { 
                subject: subject.id, // Use normalized ID (e.g., "web-development")
                subjectName: subject.name,
                subjectIcon: subject.icon,
                subjectColors: JSON.stringify(subject.colors),
              } 
            })
          }
        >
          <Text style={styles.cardButtonText}>Continue</Text>
        </TouchableOpacity>
      )}
      {isArchived && (
        <View style={styles.archivedBadge}>
          <MaterialCommunityIcons name="archive" size={14} color="#FFFFFF" />
          <Text style={styles.archivedText}>Archived</Text>
        </View>
      )}
    </LinearGradient>
  );
}

export default function JourneyScreen() {
  const router = useRouter();
  const [firstName, setFirstName] = useState<string>("");
  const [subjects, setSubjects] = useState<(Subject & { progress?: number })[]>([]);
  const [archivedSubjects, setArchivedSubjects] = useState<(Subject & { progress?: number })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Load user data
      const userData = await getUserData();
      if (userData?.first_name) {
        setFirstName(userData.first_name);
      }

      // Load user subjects and archived subjects in parallel
      console.log("Loading user subjects...");
      const [subjectsData, archivedData] = await Promise.all([
        getUserSubjects(),
        getArchivedSubjects().catch(() => ({ success: true, subjects: [], count: 0 })) // Don't fail if no archived subjects
      ]);
      
      console.log("User subjects loaded:", subjectsData);
      console.log("Archived subjects loaded:", archivedData);
      
      if (subjectsData.success && subjectsData.subjects) {
        setSubjects(subjectsData.subjects);
        
        if (subjectsData.subjects.length === 0 && activeTab === 'active') {
          // If no subjects selected, redirect to subject selection
          console.log("No subjects found, redirecting to subject selection");
          router.replace("/subject-selection");
        } else {
          console.log(`Loaded ${subjectsData.subjects.length} subjects for journey`);
        }
      } else {
        throw new Error("Invalid response from server");
      }

      if (archivedData.success && archivedData.subjects) {
        setArchivedSubjects(archivedData.subjects);
        console.log(`Loaded ${archivedData.subjects.length} archived subjects`);
      }
    } catch (err: any) {
      console.error("Error loading data:", err);
      setError(err.message || "Failed to load subjects");
      // If error, redirect to subject selection
      router.replace("/subject-selection");
    } finally {
      setIsLoading(false);
    }
  }, [router, activeTab]);

  // Load data on mount and when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Track progress for each subject to auto-archive when complete
  const [subjectProgressMap, setSubjectProgressMap] = useState<Record<string, number>>({});

  const handleProgressUpdate = useCallback((subjectId: string, progress: number) => {
    setSubjectProgressMap(prev => ({ ...prev, [subjectId]: progress }));
  }, []);

  // Auto-archive subjects when progress reaches 100%
  useEffect(() => {
    const checkAndArchiveCompleted = async () => {
      for (const subject of subjects) {
        const progress = subjectProgressMap[subject.id];
        if (progress === 100 && !subject.archivedAt) {
          try {
            console.log(`Auto-archiving completed subject: ${subject.name}`);
            await archiveSubject(subject.id);
            // Reload data to reflect changes
            loadData();
          } catch (err) {
            console.error(`Failed to auto-archive subject ${subject.name}:`, err);
          }
        }
      }
    };

    if (subjects.length > 0 && Object.keys(subjectProgressMap).length > 0) {
      checkAndArchiveCompleted();
    }
  }, [subjects, subjectProgressMap, loadData]);

  const handleArchive = async (subjectId: string, subjectName: string) => {
    // Get the current progress for this subject
    const currentProgress = subjectProgressMap[subjectId] || 0;
    const hasInProgress = currentProgress > 0 && currentProgress < 100;

    // Show confirmation dialog with different messages based on progress
    const title = hasInProgress 
      ? "Archive Subject with In-Progress Topics?" 
      : "Archive Subject?";
    
    const message = hasInProgress
      ? `Are you sure you want to archive "${subjectName}"? You have ${currentProgress}% progress with in-progress topics. You can unarchive it later to continue learning.`
      : `Are you sure you want to archive "${subjectName}"? You can unarchive it later if needed.`;

    Alert.alert(
      title,
      message,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Archive",
          style: "destructive",
          onPress: async () => {
            try {
              await archiveSubject(subjectId);
              loadData(); // Reload to update the list
            } catch (err: any) {
              console.error("Error archiving subject:", err);
              setError(err.message || "Failed to archive subject");
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleUnarchive = async (subjectId: string) => {
    try {
      await unarchiveSubject(subjectId);
      loadData(); // Reload to update the list
    } catch (err: any) {
      console.error("Error unarchiving subject:", err);
      setError(err.message || "Failed to unarchive subject");
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadData();
    } catch (err: any) {
      console.error("Error refreshing:", err);
      setError(err.message || "Failed to refresh");
    } finally {
      setRefreshing(false);
    }
  }, [loadData]);

  return (
    <LinearGradient
      colors={["#F5F9FF", "#FFFFFF"]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.background}
    >
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.headerRow}>
          <View style={styles.headerInfo}>
            <Text style={styles.greeting}>
              {firstName ? `Hello, ${firstName}` : "Hello"}
            </Text>
            <Text style={styles.title}>Your Learning Journey</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerActionButton} onPress={() => router.push("/analytics")}>
              <MaterialIcons name="notifications-none" size={22} color="#0F172A" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerActionButton} onPress={() => router.push("/profile")}>
              <MaterialIcons name="person-outline" size={22} color="#0F172A" />
            </TouchableOpacity>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1890FF" />
            <Text style={styles.loadingText}>Loading your subjects...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => router.push("/subject-selection?from=journey")}
            >
              <Text style={styles.retryButtonText}>Select Subjects</Text>
            </TouchableOpacity>
          </View>
        ) : subjects.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="book-open-variant" size={64} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No Subjects Selected</Text>
            <Text style={styles.emptyText}>
              Select subjects to start your learning journey
            </Text>
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => router.push("/subject-selection?from=journey")}
            >
              <Text style={styles.selectButtonText}>Select Subjects</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Tab Selector */}
            <View style={styles.tabSelector}>
              <TouchableOpacity
                style={[styles.tabSelectorButton, activeTab === 'active' && styles.tabSelectorButtonActive]}
                onPress={() => setActiveTab('active')}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabSelectorText, activeTab === 'active' && styles.tabSelectorTextActive]}>
                  Active ({subjects.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabSelectorButton, activeTab === 'archived' && styles.tabSelectorButtonActive]}
                onPress={() => setActiveTab('archived')}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabSelectorText, activeTab === 'archived' && styles.tabSelectorTextActive]}>
                  Archived ({archivedSubjects.length})
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.cardsContainer,
                { paddingBottom: Math.max(160, subjects.length > 6 ? 180 : 160) } // Dynamic padding based on number of subjects
              ]}
              style={styles.scrollView}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={["#1890FF"]}
                  tintColor="#1890FF"
                />
              }
            >
              {activeTab === 'active' ? (
                <>
                  {/* Add Subject Button - Placed first for quick access */}
                  <TouchableOpacity
                    style={styles.addSubjectCard}
                    onPress={() => router.push("/subject-selection?mode=add&from=journey")}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={["#F8FAFC", "#E2E8F0"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.addSubjectGradient}
                    >
                      <View style={styles.addSubjectIconWrapper}>
                        <MaterialCommunityIcons name="plus-circle" size={32} color="#1890FF" />
                      </View>
                      <Text style={styles.addSubjectText}>Add Subject</Text>
                      <Text style={styles.addSubjectSubtext}>Explore more learning paths</Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  {subjects.map((subject) => (
                    <SubjectProgressCard
                      key={subject.id}
                      subject={subject}
                      router={router}
                      onArchive={() => handleArchive(subject.id, subject.name)}
                      showArchiveButton={true}
                      onProgressUpdate={handleProgressUpdate}
                    />
                  ))}
                </>
              ) : (
                <>
                  {archivedSubjects.length === 0 ? (
                    <View style={styles.emptyContainer}>
                      <MaterialCommunityIcons name="archive-outline" size={64} color="#94A3B8" />
                      <Text style={styles.emptyTitle}>No Archived Subjects</Text>
                      <Text style={styles.emptyText}>
                        Subjects you complete or archive will appear here
                      </Text>
                    </View>
                  ) : (
                    archivedSubjects.map((subject) => (
                      <SubjectProgressCard
                        key={subject.id}
                        subject={subject}
                        router={router}
                        onArchive={() => handleUnarchive(subject.id)}
                        isArchived={true}
                        showArchiveButton={true}
                        onProgressUpdate={handleProgressUpdate}
                      />
                    ))
                  )}
                </>
              )}
            </ScrollView>
          </>
        )}
      </SafeAreaView>

      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabItem} onPress={() => router.push("/journey")}>
          <View style={[styles.tabIconWrapper, styles.tabIconWrapperActive]}>
            <MaterialCommunityIcons name="home-variant-outline" size={22} color="#1FC7B6" />
          </View>
          <Text style={[styles.tabLabel, styles.tabLabelActive]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => router.push("/analytics")}>
          <View style={styles.tabIconWrapper}>
            <MaterialCommunityIcons name="chart-line" size={20} color="#94A3B8" />
          </View>
          <Text style={styles.tabLabel}>Analytics</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => router.push("/profile")}>
          <View style={styles.tabIconWrapper}>
            <MaterialCommunityIcons name="account-circle-outline" size={22} color="#94A3B8" />
          </View>
          <Text style={styles.tabLabel}>Profile</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 0, // Let SafeAreaView handle bottom padding
  },
  scrollView: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    rowGap: 16,
  },
  headerInfo: {
    flexShrink: 1,
  },
  greeting: {
    fontSize: 16,
    fontFamily: "Roboto_400Regular",
    color: "#64748B",
  },
  title: {
    marginTop: 4,
    fontSize: 26,
    lineHeight: 32,
    fontFamily: "Montserrat_600SemiBold",
    color: "#0F172A",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    fontFamily: "Roboto_400Regular",
    color: "#94A3B8",
  },
  headerActions: {
    flexDirection: "row",
    columnGap: 12,
    flexShrink: 0,
  },
  headerActionButton: {
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
    elevation: 6,
  },
  cardsContainer: {
    paddingTop: 24,
    paddingBottom: 160, // Increased padding to prevent cards from being hidden behind tab bar
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 18,
  },
  card: {
    width: "48%",
    borderRadius: 28,
    paddingVertical: 20,
    paddingHorizontal: 18,
    shadowColor: "#1FC7B6",
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  cardIconWrapper: {
    height: 46,
    width: 46,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  cardTitle: {
    marginTop: 16,
    fontSize: 18,
    fontFamily: "Montserrat_600SemiBold",
    color: "#FFFFFF",
  },
  progressWrapper: {
    marginTop: 12,
    alignItems: "flex-start",
  },
  progressOuter: {
    height: 70,
    width: 70,
    borderRadius: 35,
    borderWidth: 6,
    borderColor: "rgba(255,255,255,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  progressInner: {
    height: 52,
    width: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  progressValue: {
    fontSize: 16,
    fontFamily: "Montserrat_600SemiBold",
    color: "#0F172A",
  },
  cardButton: {
    marginTop: 18,
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.8)",
  },
  cardButtonText: {
    fontSize: 13,
    fontFamily: "Roboto_500Medium",
    color: "#0F172A",
  },
  tabBar: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 24,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 14,
    paddingBottom: 18, // Extra padding for safe area
    shadowColor: "#CBD5F5",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
    zIndex: 10, // Ensure tab bar stays on top
  },
  tabItem: {
    alignItems: "center",
    rowGap: 6,
  },
  tabIconWrapper: {
    height: 40,
    width: 40,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  tabIconWrapperActive: {
    backgroundColor: "rgba(31,199,182,0.15)",
  },
  tabLabel: {
    fontSize: 11,
    fontFamily: "Roboto_400Regular",
    color: "#94A3B8",
  },
  tabLabelActive: {
    color: "#1FC7B6",
    fontFamily: "Roboto_500Medium",
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
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    padding: 24,
  },
  errorText: {
    fontSize: 14,
    fontFamily: "Roboto_400Regular",
    color: "#B91C1C",
    textAlign: "center",
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "#1890FF",
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 14,
    fontFamily: "Montserrat_600SemiBold",
    color: "#FFFFFF",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    padding: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Montserrat_600SemiBold",
    color: "#0F172A",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Roboto_400Regular",
    color: "#64748B",
    textAlign: "center",
  },
  selectButton: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "#1890FF",
    borderRadius: 12,
  },
  selectButtonText: {
    fontSize: 14,
    fontFamily: "Montserrat_600SemiBold",
    color: "#FFFFFF",
  },
  addSubjectCard: {
    width: "48%",
    borderRadius: 28,
    overflow: "hidden",
    shadowColor: "#1FC7B6",
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
    borderWidth: 2,
    borderColor: "#E2E8F0",
    borderStyle: "dashed",
  },
  addSubjectGradient: {
    paddingVertical: 20,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 200,
  },
  addSubjectIconWrapper: {
    marginBottom: 12,
  },
  addSubjectText: {
    fontSize: 16,
    fontFamily: "Montserrat_600SemiBold",
    color: "#1890FF",
    marginTop: 8,
  },
  addSubjectSubtext: {
    fontSize: 12,
    fontFamily: "Roboto_400Regular",
    color: "#64748B",
    marginTop: 4,
    textAlign: "center",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  archiveButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  archivedBadge: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignSelf: "center",
  },
  archivedText: {
    fontSize: 12,
    fontFamily: "Roboto_500Medium",
    color: "#FFFFFF",
  },
  tabSelector: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    marginTop: 8,
  },
  tabSelectorButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  tabSelectorButtonActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  tabSelectorText: {
    fontSize: 14,
    fontFamily: "Roboto_500Medium",
    color: "#64748B",
  },
  tabSelectorTextActive: {
    color: "#0F172A",
    fontFamily: "Montserrat_600SemiBold",
  },
});
