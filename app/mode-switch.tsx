import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEngagement } from "../hooks/use-engagement";
import { useMLRecommendation } from "../hooks/use-ml-recommendation";
import { hasCompletedAllLearningTypesFromDB } from "../lib/learning-type-service";

const MODES = [
  { id: "visual", label: "Visual", icon: "eye" },
  { id: "audio", label: "Audio", icon: "headphones" },
  { id: "text", label: "Text", icon: "book-open-variant" },
];

const METRICS = [
  {
    icon: "speedometer",
    label: "Reading Speed",
    value: "125 WPM",
    hint: "+12% vs last session",
  },
  {
    icon: "radar",
    label: "Attention",
    value: "High",
    hint: "Stable focus detected",
  },
  {
    icon: "chart-arc",
    label: "Engagement Score",
    value: "85%",
    hint: "Sustained involvement",
  },
];

export default function ModeSwitchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ subject?: string; mode?: string }>();
  const { width, height } = useWindowDimensions();
  
  // Responsive breakpoints - using more aggressive breakpoint for mobile
  const isSmall = width < 380;
  const isCompact = width < 600; // Aggressive breakpoint - most phones are < 600px
  const isMedium = width >= 600 && width < 768;
  const isLarge = width >= 768;
  const isTablet = width >= 600;
  const isLandscape = width > height;
  
  // Scale factors for responsive sizing
  const scale = Math.min(width / 375, 1.2); // Base scale on iPhone width
  const fontSizeScale = isSmall ? 0.9 : isLarge ? 1.1 : 1;
  
  // Get ML recommendation for learning mode
  const { recommendation, loading: mlLoading } = useMLRecommendation(params.subject);
  
  // Get engagement analysis
  const { engagement, loading: engagementLoading } = useEngagement(7);

  // Gate: require all learning types before continuing to content for this subject
  const [allTypesCompleted, setAllTypesCompleted] = useState(false);
  const [checkingCompletion, setCheckingCompletion] = useState(true);

  // Get progress from ML recommendation modeStats (from activity_logs database)
  const getModeProgress = (modeId: string) => {
    if (!recommendation?.modeStats) return null;
    return recommendation.modeStats[modeId as 'visual' | 'audio' | 'text'];
  };

  // Determine completed types from modeStats (has sessions = completed)
  const completedTypes = MODES.filter(mode => {
    const stats = getModeProgress(mode.id);
    return stats && stats.totalSessions > 0;
  }).map(mode => mode.id);

  useEffect(() => {
    const subjectKey = (params.subject || "math").toString();
    setCheckingCompletion(true);
    
    // Check if all types are completed from database (activity_logs)
    hasCompletedAllLearningTypesFromDB(subjectKey)
      .then((completed) => {
        setAllTypesCompleted(completed);
        console.log(`[Mode Switch] Learning types completion for ${subjectKey}:`, completed);
        if (completed) {
          console.log('✅ All learning types completed - hiding Test Your Learning Type button');
        }
      })
      .catch((err) => {
        console.error("Error checking learning type completion from database:", err);
        setAllTypesCompleted(false);
      })
      .finally(() => setCheckingCompletion(false));
  }, [params.subject]);
  
  // Use ML recommendation if available, otherwise fall back to params or default
  const mlRecommendedMode = recommendation?.recommendedMode || null;
  const activeMode = (params.mode || mlRecommendedMode || "visual").toLowerCase();
  
  const subjectLabel = params.subject
    ? params.subject.charAt(0).toUpperCase() + params.subject.slice(1)
    : "Mathematics";
  
  // Update metrics with real engagement data if available
  const realMetrics = engagement ? [
    {
      icon: "speedometer",
      label: "Reading Speed",
      value: engagement.avgScore ? `${Math.round(engagement.avgScore)}%` : "125 WPM",
      hint: engagement.trend === "improving" ? "Performance improving" : engagement.trend === "declining" ? "Performance declining" : "+12% vs last session",
    },
    {
      icon: "radar",
      label: "Attention",
      value: engagement.avgFocus > 70 ? "High" : engagement.avgFocus > 50 ? "Medium" : "Low",
      hint: engagement.trend === "stable" ? "Stable focus detected" : `Focus: ${Math.round(engagement.avgFocus)}%`,
    },
    {
      icon: "chart-arc",
      label: "Engagement Score",
      value: `${engagement.engagementScore}%`,
      hint: engagement.status === "high" ? "Sustained involvement" : engagement.status === "medium" ? "Moderate engagement" : "Needs improvement",
    },
  ] : METRICS;

  // Dynamic responsive styles
  const dynamicStyles = {
    safeArea: {
      paddingHorizontal: isSmall ? 16 : isTablet ? 32 : 24,
      paddingTop: isSmall ? 12 : 18,
      paddingBottom: isSmall ? 16 : 24,
    },
    headerTitle: {
      fontSize: isSmall ? 16 : isLarge ? 20 : 18,
    },
    backButton: {
      height: isSmall ? 40 : 44,
      width: isSmall ? 40 : 44,
    },
    backButtonPlaceholder: {
      height: isSmall ? 40 : 44,
      width: isSmall ? 40 : 44,
    },
    card: {
      padding: isSmall ? 18 : isTablet ? 32 : 28,
      borderRadius: isSmall ? 28 : 36,
      marginTop: isSmall ? 12 : 18,
    },
    cardTitle: {
      fontSize: isSmall ? 22 : isLarge ? 30 : 26,
      marginTop: isSmall ? 16 : 22,
    },
    cardSubtitle: {
      fontSize: isSmall ? 13 : isLarge ? 15 : 14,
      marginTop: isSmall ? 4 : 6,
    },
    badge: {
      paddingHorizontal: isSmall ? 12 : 16,
      paddingVertical: isSmall ? 6 : 8,
    },
    badgeText: {
      fontSize: isSmall ? 10 : 11,
    },
    modeRow: {
      marginTop: isSmall ? 18 : 24,
      padding: isSmall ? 4 : 6,
    },
    modeChip: {
      paddingVertical: isSmall ? 8 : 10,
      marginHorizontal: isSmall ? 2 : 4,
    },
    modeIcon: isSmall ? 16 : isLarge ? 20 : 18,
    modeChipLabel: {
      fontSize: isSmall ? 12 : isLarge ? 14 : 13,
      marginLeft: isSmall ? 4 : 6,
    },
    sessionRow: {
      marginTop: isSmall ? 20 : 28,
      flexDirection: (isCompact ? "column" : "row") as ViewStyle["flexDirection"],
    },
    moduleCard: {
      padding: isSmall ? 16 : isTablet ? 24 : 22,
      borderRadius: isSmall ? 24 : 28,
      width: (isCompact ? "100%" : undefined) as ViewStyle["width"],
      flex: isCompact ? 0 : 1,
    },
    moduleTitle: {
      fontSize: isSmall ? 16 : isLarge ? 20 : 18,
    },
    moduleBadge: {
      paddingHorizontal: isSmall ? 10 : 12,
      paddingVertical: isSmall ? 5 : 6,
    },
    moduleBadgeText: {
      fontSize: isSmall ? 10 : 11,
    },
    diagramPlaceholder: {
      height: isSmall ? 140 : isTablet ? 200 : 180,
      marginTop: isSmall ? 16 : 22,
      borderRadius: isSmall ? 20 : 24,
    },
    diagramIcon: isSmall ? 64 : isTablet ? 96 : 84,
    diagramFormula: {
      fontSize: isSmall ? 14 : isLarge ? 18 : 16,
      marginTop: isSmall ? 12 : 16,
    },
    metricsColumn: {
      marginLeft: 0,
      marginTop: isSmall ? 20 : 28,
      width: "100%" as ViewStyle["width"],
      flexDirection: "row" as ViewStyle["flexDirection"],
      flexWrap: "wrap" as ViewStyle["flexWrap"],
      justifyContent: "space-between" as ViewStyle["justifyContent"],
    },
    metricCard: {
      padding: isSmall ? 12 : isTablet ? 18 : 16,
      borderRadius: isSmall ? 20 : 24,
      marginBottom: isSmall ? 10 : 14,
      width: (isSmall ? "100%" : isCompact ? "48%" : "31%") as ViewStyle["width"],
    },
    metricIcon: isSmall ? 18 : isTablet ? 22 : 20,
    metricLabel: {
      fontSize: isSmall ? 11 : 12,
      marginTop: isSmall ? 10 : 12,
    },
    metricValue: {
      fontSize: isSmall ? 16 : isTablet ? 20 : 18,
      marginTop: isSmall ? 3 : 4,
    },
    metricHint: {
      fontSize: isSmall ? 10 : 11,
      marginTop: isSmall ? 3 : 4,
    },
    playerCard: {
      padding: isSmall ? 16 : isTablet ? 24 : 20,
      borderRadius: isSmall ? 24 : 28,
      marginTop: isSmall ? 20 : 28,
    },
    playerButton: {
      height: isSmall ? 42 : isTablet ? 50 : 46,
      width: isSmall ? 42 : isTablet ? 50 : 46,
      borderRadius: isSmall ? 21 : isTablet ? 25 : 23,
    },
    playerIcon: isSmall ? 18 : isTablet ? 24 : 22,
    playerIconSmall: isSmall ? 16 : isTablet ? 22 : 20,
    playerSpeedIcon: isSmall ? 16 : isTablet ? 20 : 18,
    playerSpeedLabel: {
      fontSize: isSmall ? 13 : isTablet ? 15 : 14,
    },
    progressTrack: {
      marginTop: isSmall ? 14 : 18,
    },
    confidenceCard: {
      padding: isSmall ? 16 : isTablet ? 24 : 20,
      borderRadius: isSmall ? 20 : 24,
      marginTop: isSmall ? 18 : 24,
    },
    confidenceLabel: {
      fontSize: isSmall ? 12 : isTablet ? 14 : 13,
    },
    confidenceValue: {
      fontSize: isSmall ? 24 : isTablet ? 32 : 28,
      marginTop: isSmall ? 4 : 6,
    },
    confidenceMeter: {
      height: isSmall ? 50 : isTablet ? 70 : 60,
    },
    primaryButton: {
      paddingVertical: isSmall ? 14 : isTablet ? 18 : 16,
      marginTop: isSmall ? 18 : 24,
    },
    primaryButtonLabel: {
      fontSize: isSmall ? 14 : isTablet ? 18 : 16,
    },
  };

  return (
    <LinearGradient colors={["#EEF9FF", "#FDFEFE"]} style={styles.background}>
      <SafeAreaView style={[styles.safeArea, dynamicStyles.safeArea]}>
        <View style={styles.headerRow}>
          <TouchableOpacity 
            style={[styles.backButton, dynamicStyles.backButton]} 
            activeOpacity={0.85} 
            onPress={() => router.back()}
          >
            <Ionicons 
              name="chevron-back" 
              size={isSmall ? 18 : 20} 
              color="#0F172A" 
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, dynamicStyles.headerTitle]}>
            Adaptation Overlay
          </Text>
          <View style={[styles.backButtonPlaceholder, dynamicStyles.backButtonPlaceholder]} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent, 
            isCompact && styles.scrollContentCompact,
            { paddingBottom: isSmall ? 100 : 120 } // Extra padding for sticky button
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.card, dynamicStyles.card, isCompact && styles.cardCompact]}>
            <View style={[styles.badgeRow, isSmall && { flexWrap: "wrap" }]}>
              <View style={[styles.badge, styles.badgePrimary, dynamicStyles.badge, isSmall && { marginBottom: 8 }]}>
                <Text style={[styles.badgePrimaryText, dynamicStyles.badgeText]}>
                  Adaptive Session
                </Text>
            </View>
              <View style={[styles.badge, styles.badgeAccent, dynamicStyles.badge]}>
                <Text style={[styles.badgeAccentText, dynamicStyles.badgeText]}>
                  {mlLoading ? "Analyzing..." : recommendation ? `ML: ${Math.round(recommendation.confidence * 100)}%` : "Switching Mode"}
                </Text>
            </View>
          </View>

            <Text style={[styles.cardTitle, dynamicStyles.cardTitle]}>
              {subjectLabel}
            </Text>
            <Text style={[styles.cardSubtitle, dynamicStyles.cardSubtitle]}>
              {mlLoading 
                ? "Analyzing your learning patterns..." 
                : recommendation 
                  ? recommendation.reasoning || "Monitoring live signals to confirm the optimal learning mode for this session."
                  : "Monitoring live signals to confirm the optimal learning mode for this session."}
          </Text>

            <View style={[styles.modeRow, dynamicStyles.modeRow, isCompact && styles.modeRowCompact]}>
            {MODES.map((mode) => {
              const isActive = mode.id === activeMode;
              const modeStats = getModeProgress(mode.id);
              const isCompleted = modeStats && modeStats.totalSessions > 0;
              const avgScore = modeStats && modeStats.totalSessions > 0 
                ? Math.round(modeStats.totalScore / modeStats.totalSessions) 
                : null;
              
              return (
                  <TouchableOpacity
                  key={mode.id}
                    style={[
                      styles.modeChip, 
                      dynamicStyles.modeChip,
                      isActive && styles.modeChipActive, 
                      isCompleted && !isActive && styles.modeChipCompleted,
                      isCompact && styles.modeChipCompact
                    ]}
                    onPress={() => {
                      router.push({
                        pathname: "/learning-type-test",
                        params: {
                          subject: params.subject,
                          topic: "Algebra Basics", // You can make this dynamic
                        },
                      });
                    }}
                    activeOpacity={0.7}
                >
                  <View style={styles.modeChipContent}>
                    <MaterialCommunityIcons
                      name={mode.icon as never}
                        size={dynamicStyles.modeIcon}
                      color={isActive ? "#FFFFFF" : "#64748B"}
                    />
                      <View style={styles.modeChipTextContainer}>
                        <Text 
                          style={[
                            styles.modeChipLabel, 
                            dynamicStyles.modeChipLabel,
                            isActive && styles.modeChipLabelActive
                          ]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {mode.label}
                        </Text>
                        {modeStats && modeStats.totalSessions > 0 && (
                          <Text 
                            style={[
                              styles.modeChipProgress,
                              isActive && styles.modeChipProgressActive,
                              isCompact && styles.modeChipProgressCompact
                            ]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {modeStats.totalSessions} session{modeStats.totalSessions !== 1 ? 's' : ''} • {avgScore}% avg
                          </Text>
                        )}
                      </View>
                  </View>
                  {isCompleted && (
                    <View style={styles.completionBadge}>
                      <MaterialCommunityIcons
                        name="check-circle"
                        size={isSmall ? 16 : 18}
                        color={isActive ? "#FFFFFF" : "#10B981"}
                      />
                    </View>
                  )}
                  </TouchableOpacity>
              );
            })}
          </View>
          
          {/* Progress indicator showing completion status from database */}
          {recommendation?.modeStats && (
            <View style={styles.progressIndicator}>
              <Text 
                style={styles.progressText}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                Progress: {completedTypes.length} of {MODES.length} learning types completed
              </Text>
              <View style={styles.progressBarContainer}>
                <View 
                  style={[
                    styles.progressBarFill, 
                    { width: `${(completedTypes.length / MODES.length) * 100}%` }
                  ]} 
                />
              </View>
              {/* Show detailed stats for each mode */}
              <View style={styles.modeStatsContainer}>
                {MODES.map((mode) => {
                  const stats = getModeProgress(mode.id);
                  if (!stats || stats.totalSessions === 0) return null;
                  const avgScore = Math.round(stats.totalScore / stats.totalSessions);
                  return (
                    <View key={mode.id} style={styles.modeStatItem}>
                      <MaterialCommunityIcons
                        name={mode.icon as never}
                        size={16}
                        color="#64748B"
                      />
                      <Text 
                        style={styles.modeStatText}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {mode.label}: {stats.totalSessions} session{stats.totalSessions !== 1 ? 's' : ''}, {avgScore}% avg
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Only show Test Your Learning Type button if user hasn't completed all learning types */}
          {!allTypesCompleted && !checkingCompletion && (
            <TouchableOpacity
              style={styles.testButton}
              onPress={() => {
                router.push({
                  pathname: "/learning-type-test",
                  params: {
                    subject: params.subject,
                  },
                });
              }}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="test-tube" size={20} color="#0EA5E9" />
              <Text style={styles.testButtonText}>Test Your Learning Type</Text>
            </TouchableOpacity>
          )}

          <View style={[
            styles.metricsColumn, 
            dynamicStyles.metricsColumn,
            isCompact && styles.metricsColumnCompact
          ]}>
              {realMetrics.map((metric) => (
                <View
                  key={metric.label}
                  style={[
                    styles.metricCard, 
                    dynamicStyles.metricCard,
                    isCompact && styles.metricCardCompact
                  ]}
                >
                  <View style={styles.metricHeader}>
                    <MaterialCommunityIcons 
                      name={metric.icon as never} 
                      size={dynamicStyles.metricIcon} 
                      color="#0EA5E9" 
                    />
                    <View style={styles.metricPulse} />
                  </View>
                  <Text style={[styles.metricLabel, dynamicStyles.metricLabel]}>
                    {metric.label}
                  </Text>
                  <Text style={[styles.metricValue, dynamicStyles.metricValue]}>
                    {metric.value}
                  </Text>
                  <Text style={[styles.metricHint, dynamicStyles.metricHint]}>
                    {metric.hint}
                  </Text>
                </View>
              ))}
          </View>

          <View style={[styles.confidenceCard, dynamicStyles.confidenceCard]}>
            <View>
              <Text style={[styles.confidenceLabel, dynamicStyles.confidenceLabel]}>
                Adaptation Confidence
              </Text>
              <Text style={[styles.confidenceValue, dynamicStyles.confidenceValue]}>
                {mlLoading || engagementLoading
                  ? "..."
                  : recommendation?.confidence !== undefined
                    ? `${Math.round(recommendation.confidence * 100)}%`
                    : engagement?.engagementScore !== undefined
                      ? `${Math.round(engagement.engagementScore)}%`
                      : "N/A"}
              </Text>
            </View>
            <View style={[styles.confidenceMeter, dynamicStyles.confidenceMeter]}>
              <View 
                style={[
                  styles.confidenceMeterFill,
                  {
                    height: mlLoading || engagementLoading
                      ? 0
                      : recommendation?.confidence !== undefined
                        ? `${Math.round(recommendation.confidence * 100)}%`
                        : engagement?.engagementScore !== undefined
                          ? `${Math.round(engagement.engagementScore)}%`
                          : "0%"
                  }
                ]} 
              />
            </View>
          </View>
        </View>
        </ScrollView>

        {/* Sticky View Topics Button */}
        <View style={styles.stickyButtonContainer}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={[
              styles.primaryButton,
              dynamicStyles.primaryButton,
              (!allTypesCompleted || checkingCompletion) && { opacity: 0.6 },
            ]}
            disabled={!allTypesCompleted || checkingCompletion}
            onPress={() => {
              if (!allTypesCompleted) return;
              router.push({ pathname: "/topics", params: { subject: params.subject ?? "math" } });
            }}
          >
            <Text style={[styles.primaryButtonLabel, dynamicStyles.primaryButtonLabel]}>
              {checkingCompletion
                ? "Checking learning type progress..."
                : allTypesCompleted
                  ? "View Topics"
                  : "Complete All Learning Types to Continue"}
            </Text>
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontFamily: "Montserrat_600SemiBold",
    color: "#0F172A",
    flex: 1,
    textAlign: "center",
  },
  backButton: {
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#38BDF8",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  backButtonPlaceholder: {
    // Size handled by dynamic styles
  },
  card: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    shadowColor: "#BAE6FD",
    shadowOpacity: 0.35,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 10,
  },
  cardCompact: {
    // Padding handled by dynamic styles
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
    flexGrow: 1,
  },
  scrollContentCompact: {
    paddingBottom: 48,
  },
  badgeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  badge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  badgePrimary: {
    backgroundColor: "#DCF3FF",
  },
  badgeAccent: {
    backgroundColor: "#D1FAE5",
  },
  badgePrimaryText: {
    fontFamily: "Roboto_500Medium",
    color: "#0284C7",
  },
  badgeAccentText: {
    fontFamily: "Roboto_500Medium",
    color: "#047857",
  },
  cardTitle: {
    fontFamily: "Montserrat_600SemiBold",
    color: "#0F172A",
  },
  cardSubtitle: {
    lineHeight: 19,
    fontFamily: "Roboto_400Regular",
    color: "#64748B",
  },
  modeRow: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderRadius: 999,
    padding: 6,
  },
  modeRowCompact: {
    flexWrap: "wrap",
    rowGap: 8,
    justifyContent: "center",
  },
  modeChip: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginHorizontal: 4,
    position: "relative",
    minHeight: 60,
    maxWidth: "100%",
  },
  modeChipCompact: {
    minWidth: "28%",
    maxWidth: "32%",
    paddingHorizontal: 4,
  },
  modeChipActive: {
    backgroundColor: "#0EA5E9",
    shadowColor: "#0284C7",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  modeChipLabel: {
    fontFamily: "Montserrat_500Medium",
    color: "#64748B",
    textAlign: "center",
    maxWidth: "100%",
  },
  modeChipLabelActive: {
    color: "#FFFFFF",
  },
  modeChipContent: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    gap: 4,
  },
  modeChipTextContainer: {
    alignItems: "center",
    width: "100%",
    maxWidth: "100%",
    paddingHorizontal: 4,
  },
  modeChipProgress: {
    fontSize: 9,
    fontFamily: "Roboto_400Regular",
    color: "#94A3B8",
    marginTop: 2,
    textAlign: "center",
    maxWidth: "100%",
  },
  modeChipProgressCompact: {
    fontSize: 8,
  },
  modeChipProgressActive: {
    color: "#BAE6FD",
  },
  modeChipCompleted: {
    backgroundColor: "#D1FAE5",
    borderWidth: 1,
    borderColor: "#10B981",
  },
  completionBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  progressIndicator: {
    marginTop: 20,
    padding: 16,
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    width: "100%",
    maxWidth: "100%",
  },
  progressText: {
    fontSize: 13,
    fontFamily: "Roboto_500Medium",
    color: "#64748B",
    marginBottom: 8,
    flexWrap: "wrap",
  },
  progressBarContainer: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#E2E8F0",
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#10B981",
    borderRadius: 3,
  },
  modeStatsContainer: {
    marginTop: 12,
    gap: 8,
  },
  modeStatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  modeStatText: {
    fontSize: 12,
    fontFamily: "Roboto_400Regular",
    color: "#64748B",
    flex: 1,
    flexShrink: 1,
  },
  testButton: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: "#F0F9FF",
    borderWidth: 2,
    borderColor: "#0EA5E9",
  },
  testButtonText: {
    fontSize: 15,
    fontFamily: "Montserrat_600SemiBold",
    color: "#0EA5E9",
  },
  sessionRow: {
    marginTop: 28,
    flexDirection: "row",
  },
  sessionRowCompact: {
    flexDirection: "column",
  },
  moduleCard: {
    flex: 1,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 22,
    backgroundColor: "#FFFFFF",
  },
  moduleCardCompact: {
    marginRight: 0,
    flex: 0,
    width: "100%",
  },
  moduleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  moduleTitle: {
    fontFamily: "Montserrat_600SemiBold",
    color: "#0F172A",
    flex: 1,
  },
  moduleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#CCFBF1",
  },
  moduleBadgeText: {
    fontFamily: "Roboto_500Medium",
    color: "#0F766E",
  },
  diagramPlaceholder: {
    borderWidth: 1,
    borderColor: "#99F6E4",
    borderStyle: "dashed",
    backgroundColor: "#ECFEFF",
    justifyContent: "center",
    alignItems: "center",
  },
  diagramFormula: {
    textAlign: "center",
    fontFamily: "Roboto_400Regular",
    color: "#334155",
  },
  metricsColumn: {
    justifyContent: "space-between",
  },
  metricsColumnCompact: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  metricCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    backgroundColor: "#FFFFFF",
    shadowColor: "#E0F2FE",
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
    marginBottom: 14,
  },
  metricCardCompact: {
    width: "48%",
    marginBottom: 14,
  },
  metricHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metricPulse: {
    height: 6,
    width: 6,
    borderRadius: 3,
    backgroundColor: "#22C55E",
  },
  metricLabel: {
    fontFamily: "Roboto_400Regular",
    color: "#6B7280",
  },
  metricValue: {
    fontFamily: "Montserrat_600SemiBold",
    color: "#0F172A",
  },
  metricHint: {
    fontFamily: "Roboto_400Regular",
    color: "#94A3B8",
  },
  playerCard: {
    marginTop: 28,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 20,
    backgroundColor: "#FFFFFF",
  },
  playerControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  playerButton: {
    backgroundColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
  },
  playerButtonPrimary: {
    backgroundColor: "#0EA5E9",
    shadowColor: "#0EA5E9",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  playerSpeed: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
  },
  playerSpeedLabel: {
    fontFamily: "Roboto_500Medium",
    color: "#0F172A",
  },
  progressTrack: {
    marginTop: 18,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#E2E8F0",
    overflow: "hidden",
  },
  progressFill: {
    width: "65%",
    height: "100%",
    backgroundColor: "#0EA5E9",
  },
  confidenceCard: {
    marginTop: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 20,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  confidenceLabel: {
    fontFamily: "Roboto_500Medium",
    color: "#64748B",
  },
  confidenceValue: {
    fontFamily: "Montserrat_600SemiBold",
    color: "#0F172A",
  },
  confidenceMeter: {
    width: 8,
    borderRadius: 999,
    backgroundColor: "#E2E8F0",
    overflow: "hidden",
  },
  confidenceMeterFill: {
    width: "100%",
    backgroundColor: "#22C55E",
    borderRadius: 999,
    position: "absolute",
    bottom: 0,
  },
  primaryButton: {
    borderRadius: 999,
    backgroundColor: "#10B981",
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#10B981",
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  primaryButtonLabel: {
    fontFamily: "Montserrat_600SemiBold",
    color: "#FFFFFF",
  },
  stickyButtonContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 12,
    backgroundColor: "#EEF9FF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
});

