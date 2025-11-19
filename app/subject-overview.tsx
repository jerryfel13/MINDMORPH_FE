import { SubjectMode } from "@/constants/subjects";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMLRecommendation } from "../hooks/use-ml-recommendation";
import { useSubjectProgress } from "../hooks/use-subject-progress";
import { hasCompletedAllLearningTypesFromDB } from "../lib/learning-type-service";
import { getQuizHistory } from "../lib/quiz-service";
import { getTopicsFromDB, Topic } from "../lib/topics-service";

const MODE_CONTENT: Record<
  SubjectMode,
  { label: string; description: string; icon: string; gradient: [string, string] }
> = {
  visual: {
    label: "Visual Mode",
    description: "Interactive diagrams, spatial breakdowns, and short visual explainers.",
    icon: "eye-circle",
    gradient: ["#06B6D4", "#3B82F6"],
  },
  audio: {
    label: "Audio Mode",
    description: "Narrated walkthroughs, focus playlists, and key concept recaps.",
    icon: "headphones",
    gradient: ["#F97316", "#F43F5E"],
  },
  text: {
    label: "Text Mode",
    description: "Guided notes, memory prompts, and concise theory summaries.",
    icon: "book-open-variant",
    gradient: ["#A855F7", "#6366F1"],
  },
};

export default function SubjectOverviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ 
    subject?: string; 
    subjectName?: string; 
    subjectIcon?: string; 
    subjectColors?: string;
  }>();
  
  const subjectId = params.subject?.toString() || "";
  const subjectName = params.subjectName?.toString() || "";
  const subjectIcon = params.subjectIcon?.toString() || "book-open-variant";
  const subjectColors = params.subjectColors ? JSON.parse(params.subjectColors as string) : ["#2491FF", "#58CBFF"];

  // Create subject object from params
  const subject = useMemo(() => {
    if (!subjectId || !subjectName) return null;
    
    // Default recommended modes - can be customized per subject later
    return {
      id: subjectId,
      title: subjectName,
      icon: subjectIcon,
      colors: subjectColors,
      recommendedModes: ['visual', 'audio', 'text'] as SubjectMode[],
    };
  }, [subjectId, subjectName, subjectIcon, subjectColors]);

  const { recommendation } = useMLRecommendation(subjectId);
  const { progress: realProgress } = useSubjectProgress(subjectId);
  
  const [topics, setTopics] = useState<Topic[]>([]);
  const [completedTopics, setCompletedTopics] = useState<Set<string>>(new Set());
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [allLearningTypesCompleted, setAllLearningTypesCompleted] = useState(false);
  const [checkingLearningTypes, setCheckingLearningTypes] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize loading state
  useEffect(() => {
    if (subject) {
      setIsLoading(false);
    } else if (!subjectId || !subjectName) {
      // If no subject data, redirect back after a timeout
      const timer = setTimeout(() => {
        console.warn("Subject data not found, redirecting back");
        router.back();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [subject, subjectId, subjectName, router]);

  // Check if user has completed all learning types from database (activity_logs)
  useEffect(() => {
    const checkLearningTypesCompletion = async () => {
      if (!subjectId) {
        setCheckingLearningTypes(false);
        return;
      }
      
      try {
        // Check database for quiz results in activity_logs
        const result = await hasCompletedAllLearningTypesFromDB(subjectId);
        console.log(`[Subject Overview] Learning types completion for ${subjectId}:`, result);
        setAllLearningTypesCompleted(result.completed);
        if (result.completed) {
          console.log('✅ All learning types completed - hiding Recommended Modes section');
        } else if (result.allScoresZero) {
          console.log('⚠️ All learning types completed but all scores are 0');
        } else {
          console.log('❌ Not all learning types completed - showing Recommended Modes section');
        }
      } catch (error) {
        console.error("Error checking learning types completion from database:", error);
        setAllLearningTypesCompleted(false);
      } finally {
        setCheckingLearningTypes(false);
      }
    };

    checkLearningTypesCompletion();
  }, [subjectId]);

  // Get user's best performing learning type
  const userLearningType = useMemo(() => {
    if (!recommendation) return null;
    return recommendation.bestPerformingMode || recommendation.recommendedMode || null;
  }, [recommendation]);

  // Get the mode content for user's learning type
  const userLearningTypeContent = useMemo(() => {
    if (!userLearningType) return null;
    return MODE_CONTENT[userLearningType as SubjectMode];
  }, [userLearningType]);

  const recommendedModes = useMemo(() => {
    if (!subject) return [];
    return subject.recommendedModes.map((mode) => MODE_CONTENT[mode]);
  }, [subject]);

  // Load topics and check completion status
  useEffect(() => {
    const loadTopicsAndProgress = async () => {
      if (!subjectId) return;
      
      try {
        setLoadingTopics(true);
        
        // Get best learning type for topic lookup
        const bestType = recommendation?.bestPerformingMode || recommendation?.recommendedMode || 'text';
        
        // Load topics
        const topicsData = await getTopicsFromDB(subjectId, bestType as 'visual' | 'audio' | 'text');
        if (topicsData && topicsData.topics.length > 0) {
          setTopics(topicsData.topics);
        }
        
        // Load quiz results to determine completed topics
        try {
          const quizHistory = await getQuizHistory(subjectId);
          if (quizHistory.results && quizHistory.results.length > 0) {
            const completed = new Set<string>();
            quizHistory.results.forEach((quiz: any) => {
              if (quiz.topic) {
                completed.add(quiz.topic.toLowerCase());
              }
            });
            setCompletedTopics(completed);
          }
        } catch (quizError) {
          console.warn("Failed to load quiz history:", quizError);
        }
      } catch (error) {
        console.error("Failed to load topics:", error);
      } finally {
        setLoadingTopics(false);
      }
    };

    loadTopicsAndProgress();
  }, [subjectId, recommendation]);

  if (isLoading || !subject) {
    return (
      <SafeAreaView style={styles.fallback}>
        <ActivityIndicator color="#0F172A" size="large" />
        <Text style={styles.fallbackText}>Loading subject overview…</Text>
        {!subjectId && (
          <Text style={[styles.fallbackText, { marginTop: 8, fontSize: 12 }]}>
            Missing subject information. Redirecting...
          </Text>
        )}
      </SafeAreaView>
    );
  }

  return (
    <LinearGradient
      colors={["#F4F8FF", "#FFFFFF"]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.background}
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="chevron-left" size={24} color="#0F172A" />
            </TouchableOpacity>
            <View>
              <Text style={styles.subtitle}>Learning Path</Text>
              <Text style={styles.title}>{subject.title}</Text>
            </View>
            <View style={styles.progressBadge}>
              <Text style={styles.progressLabel}>Progress</Text>
              <Text style={styles.progressValue}>{realProgress}%</Text>
            </View>
          </View>

          {!checkingLearningTypes && !allLearningTypesCompleted && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recommended Modes</Text>
                <Text style={styles.sectionSubtitle}>Complete learning type tests to see your personalized mode</Text>
              </View>
              <View style={styles.modeRow}>
                {recommendedModes.map((mode) => (
                  <LinearGradient
                    key={mode.label}
                    colors={mode.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.modeCard}
                  >
                    <View style={styles.modeIconWrapper}>
                      <MaterialCommunityIcons name={mode.icon as never} size={26} color="#FFFFFF" />
                    </View>
                    <Text style={styles.modeLabel}>{mode.label}</Text>
                    <Text style={styles.modeDescription}>{mode.description}</Text>
                  </LinearGradient>
                ))}
              </View>
            </>
          )}

          <View style={styles.topicsCard}>
            <Text style={styles.topicsTitle}>Your Topics</Text>
            {loadingTopics ? (
              <View style={styles.topicsLoading}>
                <ActivityIndicator size="small" color="#1FC7B6" />
                <Text style={styles.topicsLoadingText}>Loading topics...</Text>
              </View>
            ) : topics.length === 0 ? (
              <View style={styles.topicsEmpty}>
                <MaterialCommunityIcons name="book-open-outline" size={32} color="#94A3B8" />
                <Text style={styles.topicsEmptyText}>No topics available yet</Text>
                <Text style={styles.topicsEmptySubtext}>Complete learning type tests to generate topics</Text>
              </View>
            ) : (
              <View style={styles.topicsList}>
                {/* Completed Topics */}
                {topics.filter(t => completedTopics.has(t.title.toLowerCase())).length > 0 && (
                  <View style={styles.topicsSection}>
                    <View style={styles.topicsSectionHeader}>
                      <MaterialCommunityIcons name="check-circle" size={20} color="#10B981" />
                      <Text style={styles.topicsSectionTitle}>Completed</Text>
                    </View>
                    {topics
                      .filter(t => completedTopics.has(t.title.toLowerCase()))
                      .map((topic) => (
                        <TouchableOpacity
                          key={topic.id}
                          style={styles.topicItem}
                          onPress={() =>
                            router.push({
                              pathname: "/module",
                              params: {
                                subject: subjectId,
                                topic: topic.title,
                                learningType: topic.learningType,
                              },
                            })
                          }
                          activeOpacity={0.7}
                        >
                          <View style={styles.topicItemContent}>
                            <MaterialCommunityIcons name="check-circle" size={18} color="#10B981" />
                            <Text style={styles.topicItemText}>{topic.title}</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                  </View>
                )}

                {/* In Progress Topics */}
                {topics.filter(t => !completedTopics.has(t.title.toLowerCase())).length > 0 && (
                  <View style={styles.topicsSection}>
                    <View style={styles.topicsSectionHeader}>
                      <MaterialCommunityIcons name="clock-outline" size={20} color="#F59E0B" />
                      <Text style={styles.topicsSectionTitle}>In Progress</Text>
                    </View>
                    {topics
                      .filter(t => !completedTopics.has(t.title.toLowerCase()))
                      .map((topic) => (
                        <TouchableOpacity
                          key={topic.id}
                          style={styles.topicItem}
                          onPress={() =>
                            router.push({
                              pathname: "/module",
                              params: {
                                subject: subjectId,
                                topic: topic.title,
                                learningType: topic.learningType,
                              },
                            })
                          }
                          activeOpacity={0.7}
                        >
                          <View style={styles.topicItemContent}>
                            <MaterialCommunityIcons name="circle-outline" size={18} color="#F59E0B" />
                            <Text style={styles.topicItemText}>{topic.title}</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                  </View>
                )}
              </View>
            )}
          </View>
        </ScrollView>
        
        {/* Sticky Start Session Button */}
        <View style={styles.stickyButtonContainer}>
          <TouchableOpacity
            style={styles.primaryCta}
            activeOpacity={0.85}
            onPress={() =>
              router.push({
                pathname: "/mode-switch",
                params: { subject: subject.id, mode: recommendedModes[0]?.label ?? "Visual" },
              })
            }
          >
            <Text style={styles.primaryCtaText}>Start Session</Text>
          </TouchableOpacity>
        </View>
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
    paddingBottom: 100, // Extra padding for sticky button
    rowGap: 22,
  },
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  fallbackText: {
    marginTop: 16,
    fontSize: 14,
    fontFamily: "Roboto_400Regular",
    color: "#64748B",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 16,
  },
  backButton: {
    height: 48,
    width: 48,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#CBD5F5",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Roboto_500Medium",
    color: "#1FC7B6",
  },
  title: {
    marginTop: 2,
    fontSize: 24,
    lineHeight: 30,
    fontFamily: "Montserrat_600SemiBold",
    color: "#0F172A",
  },
  progressBadge: {
    marginLeft: "auto",
    alignItems: "flex-end",
  },
  progressLabel: {
    fontSize: 11,
    fontFamily: "Roboto_400Regular",
    color: "#94A3B8",
  },
  progressValue: {
    marginTop: 4,
    fontSize: 18,
    fontFamily: "Montserrat_600SemiBold",
    color: "#0F172A",
  },
  sectionHeader: {
    rowGap: 6,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Montserrat_600SemiBold",
    color: "#0F172A",
  },
  sectionSubtitle: {
    fontSize: 13,
    fontFamily: "Roboto_400Regular",
    color: "#94A3B8",
  },
  modeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 16,
  },
  modeCard: {
    width: "48%",
    borderRadius: 28,
    paddingVertical: 20,
    paddingHorizontal: 18,
    shadowColor: "#38BDF8",
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 7,
  },
  modeIconWrapper: {
    height: 44,
    width: 44,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  modeLabel: {
    marginTop: 14,
    fontSize: 16,
    fontFamily: "Montserrat_600SemiBold",
    color: "#FFFFFF",
  },
  modeDescription: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Roboto_400Regular",
    color: "rgba(255,255,255,0.85)",
  },
  singleModeCard: {
    width: "100%",
  },
  loadingModesContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    columnGap: 12,
  },
  loadingModesText: {
    fontSize: 14,
    fontFamily: "Roboto_400Regular",
    color: "#64748B",
  },
  confidenceBadge: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  confidenceText: {
    fontSize: 11,
    fontFamily: "Roboto_500Medium",
    color: "#FFFFFF",
  },
  topicsCard: {
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    padding: 24,
    shadowColor: "#CBD5F5",
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  topicsTitle: {
    fontSize: 16,
    fontFamily: "Montserrat_600SemiBold",
    color: "#0F172A",
    marginBottom: 18,
  },
  topicsLoading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    columnGap: 12,
  },
  topicsLoadingText: {
    fontSize: 14,
    fontFamily: "Roboto_400Regular",
    color: "#64748B",
  },
  topicsEmpty: {
    alignItems: "center",
    paddingVertical: 32,
    rowGap: 12,
  },
  topicsEmptyText: {
    fontSize: 14,
    fontFamily: "Roboto_500Medium",
    color: "#64748B",
  },
  topicsEmptySubtext: {
    fontSize: 12,
    fontFamily: "Roboto_400Regular",
    color: "#94A3B8",
  },
  topicsList: {
    rowGap: 20,
  },
  topicsSection: {
    rowGap: 12,
  },
  topicsSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
    marginBottom: 4,
  },
  topicsSectionTitle: {
    fontSize: 14,
    fontFamily: "Montserrat_600SemiBold",
    color: "#0F172A",
  },
  topicItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
  },
  topicItemContent: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
  },
  topicItemText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Roboto_400Regular",
    color: "#475569",
  },
  stickyButtonContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 12,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  primaryCta: {
    borderRadius: 999,
    backgroundColor: "#1FC7B6",
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1FC7B6",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  primaryCtaText: {
    fontSize: 18,
    fontFamily: "Montserrat_600SemiBold",
    color: "#FFFFFF",
  },
});



