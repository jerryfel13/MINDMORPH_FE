import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Polyline, Svg } from "react-native-svg";
import { getComprehensiveAnalytics } from "@/lib/ml-service";

type ScorePair = [number, number];

interface QuizScores {
  visual: ScorePair[];
  audio: ScorePair[];
  text: ScorePair[];
}

type Points = string;

interface LinePoints {
  visual: Points;
  audio: Points;
  text: Points;
}

function toPercentages(arr: ScorePair[]): number[] {
  return arr.map(([score, length]) =>
    length === 0 ? 0 : (score / length) * 100
  );
}

function toLinePoints(percentages: number[]): string {
  const count = percentages.length;
  if (count === 0) return "";

  return percentages
    .map((percent, index) => {
      const x = (index / (count - 1)) * 250;
      const y = 100 - percent;
      return `${x.toFixed(0)},${y.toFixed(0)}`;
    })
    .join(" ");
}


interface SubjectPerformance {
  label: string;
  percent: number;
  color: string;
}

export default function AnalyticsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ origin?: string; subject?: string }>();
  const subjectLabel = params.subject
    ? params.subject.charAt(0).toUpperCase() + params.subject.slice(1)
    : undefined;

  const [quizScores, setQuizScores] = useState<QuizScores>({
    visual: [],
    audio: [],
    text: []
  });

  const [linePoints, setLinePoints] = useState<LinePoints>({
    visual: "",
    audio: "",
    text: ""
  });

  const [subjectPerformance, setSubjectPerformance] = useState<SubjectPerformance[]>([]);
  const [overallPercent, setOverallPercent] = useState(0);
  const [engagementData, setEngagementData] = useState<any>(null);
  const [improvementSuggestions, setImprovementSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [currentMonth, setCurrentMonth] = useState<string>("");

  // Initialize current month on mount
  useEffect(() => {
    const now = new Date();
    setCurrentMonth(now.toLocaleString('en-US', { month: 'long', year: 'numeric' }));
  }, []);

  // Fetch analytics data
  useEffect(() => {
    fetchAnalyticsData();
  }, [params.subject]);

  const fetchAnalyticsData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch comprehensive analytics in a single call
      const analytics = await getComprehensiveAnalytics(params.subject);

      // Set quiz scores
      setQuizScores(analytics.quizScores);

      // Set subject performance
      setSubjectPerformance(analytics.subjectPerformance);

      // Set overall percent
      setOverallPercent(analytics.overallPercent);

      // Set engagement data
      setEngagementData(analytics.engagement);

      // Set improvement suggestions
      setImprovementSuggestions(analytics.improvementSuggestions || []);

      // Set last update time
      if (analytics.lastUpdate) {
        const updateDate = new Date(analytics.lastUpdate);
        setLastUpdate(updateDate.toLocaleString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit', 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        }));
        // Set current month from last update date
        setCurrentMonth(updateDate.toLocaleString('en-US', { month: 'long', year: 'numeric' }));
      } else {
        // Fallback to current date
        const now = new Date();
        setCurrentMonth(now.toLocaleString('en-US', { month: 'long', year: 'numeric' }));
      }

    } catch (err: any) {
      console.error("Error fetching analytics:", err);
      setError(err.message || "Failed to load analytics data");
      // Set default/fallback data
      setQuizScores({ visual: [], audio: [], text: [] });
      setSubjectPerformance([]);
      setOverallPercent(0);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const percentages = {
      visual: toPercentages(quizScores.visual),
      audio: toPercentages(quizScores.audio),
      text: toPercentages(quizScores.text)
    };

    setLinePoints({
      visual: toLinePoints(percentages.visual),
      audio: toLinePoints(percentages.audio),
      text: toLinePoints(percentages.text)
    });
  }, [quizScores]); 

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
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={20} color="#0F172A" />
            </TouchableOpacity>
            <View style={styles.monthPill}>
              <Ionicons name="chevron-back" size={16} color="#0F172A" />
              <Text style={styles.monthLabel}>
                {currentMonth || new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#0F172A" />
            </View>
          </View>

          <View style={styles.header}>
            <Text style={styles.headerTitle}>Learning Insights</Text>
            {params.origin === "quiz" && subjectLabel ? (
              <Text style={styles.headerSubtitle}>
                Quiz results for {subjectLabel} synced. Adaptive recommendations updated.
              </Text>
            ) : null}
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity onPress={fetchAnalyticsData} style={styles.retryButton}>
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1890FF" />
              <Text style={styles.loadingText}>Loading analytics...</Text>
            </View>
          ) : (
            <>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Learning Style Evolution</Text>
            {quizScores.visual.length === 0 && quizScores.audio.length === 0 && quizScores.text.length === 0 ? (
              <View style={styles.noDataContainer}>
                <Text style={styles.noDataText}>No quiz data available yet. Complete quizzes to see your learning style evolution.</Text>
              </View>
            ) : (
              <>
                <View style={styles.chartWrapper}>
                  <Svg height="160" width="100%">
                    {linePoints.visual && (
                      <Polyline
                        points={linePoints.visual}
                        fill="none"
                        stroke="#38BDF8"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                    {linePoints.audio && (
                      <Polyline
                        points={linePoints.audio}
                        fill="none"
                        stroke="#F97316"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                    {linePoints.text && (
                      <Polyline
                        points={linePoints.text}
                        fill="none"
                        stroke="#A855F7"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                  </Svg>
                </View>
                <View style={styles.legendRow}>
                  {[
                    { label: "Visual", color: "#38BDF8", count: quizScores.visual.length },
                    { label: "Audio", color: "#F97316", count: quizScores.audio.length },
                    { label: "Text", color: "#A855F7", count: quizScores.text.length },
                  ].map((item) => (
                    <View key={item.label} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                      <Text style={styles.legendLabel}>
                        {item.label} {item.count > 0 && `(${item.count})`}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Subject Performance</Text>
            <View style={styles.performanceBarWrapper}>
              <View style={styles.overallBar}>
                <View style={[styles.overallFill, { width: `${overallPercent}%` }]} />
                <View style={styles.overallPercentBadge}>
                  <Text style={styles.overallPercentText}>{overallPercent}%</Text>
                </View>
              </View>
            </View>
            {subjectPerformance.length > 0 ? (
              subjectPerformance.map((item) => (
                <View key={item.label} style={styles.subjectRow}>
                  <Text style={styles.subjectLabel}>{item.label}</Text>
                  <View style={styles.subjectBar}>
                    <View style={[styles.subjectFill, { width: `${item.percent}%`, backgroundColor: item.color }]} />
                  </View>
                  <Text style={styles.subjectPercent}>{item.percent}%</Text>
                </View>
              ))
            ) : (
              <Text style={styles.noDataText}>No subject performance data available</Text>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Engagement Patterns</Text>
            {engagementData ? (
              <>
                <View style={styles.engagementStats}>
                  <View style={styles.engagementStat}>
                    <Text style={styles.engagementStatValue}>{engagementData.engagementScore || 0}%</Text>
                    <Text style={styles.engagementStatLabel}>Engagement</Text>
                  </View>
                  <View style={styles.engagementStat}>
                    <Text style={styles.engagementStatValue}>{engagementData.avgFocus || 0}%</Text>
                    <Text style={styles.engagementStatLabel}>Avg Focus</Text>
                  </View>
                  <View style={styles.engagementStat}>
                    <Text style={styles.engagementStatValue}>{Math.round((engagementData.totalTime || 0) / 60)}m</Text>
                    <Text style={styles.engagementStatLabel}>Study Time</Text>
                  </View>
                </View>
                {engagementData.status && (
                  <View style={[styles.engagementStatus, { 
                    backgroundColor: engagementData.status === 'high' ? 'rgba(34, 197, 94, 0.1)' :
                                    engagementData.status === 'medium' ? 'rgba(251, 146, 60, 0.1)' :
                                    'rgba(239, 68, 68, 0.1)'
                  }]}>
                    <Text style={styles.engagementStatusText}>
                      Status: {engagementData.status.charAt(0).toUpperCase() + engagementData.status.slice(1)}
                      {engagementData.trend && ` • ${engagementData.trend.charAt(0).toUpperCase() + engagementData.trend.slice(1)}`}
                    </Text>
                  </View>
                )}
                {engagementData.alerts && engagementData.alerts.length > 0 && (
                  <View style={styles.alertsContainer}>
                    {engagementData.alerts.map((alert: string, index: number) => (
                      <View key={index} style={styles.alertItem}>
                        <Ionicons name="alert-circle" size={16} color="#F59E0B" />
                        <Text style={styles.alertText}>{alert}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            ) : (
              <View style={styles.heatmap}>
                {[...Array(56).keys()].map((index) => (
                  <View
                    key={index}
                    style={[
                      styles.heatCell,
                      {
                        backgroundColor: `rgba(251, 146, 60, ${
                          0.25 + ((index % 7) + 2) / 12
                        })`,
                      },
                    ]}
                  />
                ))}
              </View>
            )}
            {!engagementData && (
              <View style={styles.heatmapLabels}>
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                  <Text key={day} style={styles.heatmapLabel}>
                    {day}
                  </Text>
                ))}
              </View>
            )}
          </View>

          {improvementSuggestions.length > 0 && (
            <View style={styles.card}>
              <View style={styles.suggestionsHeader}>
                <Ionicons name="bulb" size={20} color="#F59E0B" />
                <Text style={styles.cardTitle}>AI-Powered Improvement Suggestions</Text>
              </View>
              <View style={styles.suggestionsList}>
                {improvementSuggestions.map((suggestion, index) => (
                  <View key={index} style={styles.suggestionItem}>
                    <View style={styles.suggestionBullet} />
                    <Text style={styles.suggestionText}>{suggestion}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <Text style={styles.footerNote}>
            {lastUpdate ? `Last update • ${lastUpdate}` : "No data available"}
          </Text>
            </>
          )}
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
    rowGap: 22,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
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
  monthPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    columnGap: 14,
    shadowColor: "#CBD5F5",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  monthLabel: {
    fontSize: 15,
    fontFamily: "Montserrat_600SemiBold",
    color: "#0F172A",
  },
  header: {
    marginTop: 6,
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: "Montserrat_600SemiBold",
    color: "#0F172A",
  },
  headerSubtitle: {
    marginTop: 6,
    fontSize: 14,
    fontFamily: "Roboto_400Regular",
    color: "#94A3B8",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 24,
    shadowColor: "#CBD5F5",
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: "Montserrat_600SemiBold",
    color: "#0F172A",
  },
  chartWrapper: {
    marginTop: 18,
  },
  legendRow: {
    flexDirection: "row",
    columnGap: 16,
    marginTop: 14,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
  },
  legendDot: {
    height: 10,
    width: 10,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: 12,
    fontFamily: "Roboto_500Medium",
    color: "#64748B",
  },
  performanceBarWrapper: {
    marginTop: 20,
    marginBottom: 12,
  },
  overallBar: {
    height: 18,
    borderRadius: 9,
    backgroundColor: "#E2E8F0",
    overflow: "hidden",
    position: "relative",
  },
  overallFill: {
    height: "100%",
    width: "85%",
    borderRadius: 9,
    backgroundColor: "#22C55E",
  },
  overallPercentBadge: {
    position: "absolute",
    right: 6,
    top: -20,
    backgroundColor: "#22C55E",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  overallPercentText: {
    fontSize: 12,
    color: "#FFFFFF",
    fontFamily: "Roboto_500Medium",
  },
  subjectRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    columnGap: 12,
  },
  subjectLabel: {
    width: 110,
    fontSize: 13,
    fontFamily: "Roboto_500Medium",
    color: "#0F172A",
  },
  subjectBar: {
    flex: 1,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#F1F5F9",
    overflow: "hidden",
  },
  subjectFill: {
    height: "100%",
    borderRadius: 6,
  },
  subjectPercent: {
    width: 40,
    textAlign: "right",
    fontSize: 13,
    fontFamily: "Roboto_500Medium",
    color: "#0F172A",
  },
  heatmap: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 6,
    columnGap: 6,
    marginTop: 18,
  },
  heatCell: {
    height: 16,
    width: 16,
    borderRadius: 4,
  },
  heatmapLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
  },
  heatmapLabel: {
    fontSize: 12,
    fontFamily: "Roboto_400Regular",
    color: "#94A3B8",
  },
  footerNote: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 11,
    fontFamily: "Roboto_400Regular",
    color: "#94A3B8",
  },
  secondaryCta: {
    marginTop: 8,
    borderRadius: 999,
    backgroundColor: "#0EA5E9",
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0EA5E9",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  secondaryCtaText: {
    fontSize: 15,
    fontFamily: "Montserrat_600SemiBold",
    color: "#FFFFFF",
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: "Roboto_400Regular",
    color: "#64748B",
  },
  errorContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderRadius: 12,
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Roboto_500Medium",
    color: "#B91C1C",
  },
  retryButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#EF4444",
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 12,
    fontFamily: "Roboto_500Medium",
    color: "#FFFFFF",
  },
  noDataText: {
    fontSize: 13,
    fontFamily: "Roboto_400Regular",
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 12,
    fontStyle: "italic",
  },
  noDataContainer: {
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  engagementStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 18,
    marginBottom: 16,
  },
  engagementStat: {
    alignItems: "center",
    gap: 6,
  },
  engagementStatValue: {
    fontSize: 24,
    fontFamily: "Montserrat_600SemiBold",
    color: "#0F172A",
  },
  engagementStatLabel: {
    fontSize: 12,
    fontFamily: "Roboto_400Regular",
    color: "#64748B",
  },
  engagementStatus: {
    padding: 12,
    borderRadius: 12,
    marginTop: 12,
  },
  engagementStatusText: {
    fontSize: 13,
    fontFamily: "Roboto_500Medium",
    color: "#0F172A",
    textAlign: "center",
  },
  alertsContainer: {
    marginTop: 16,
    gap: 8,
  },
  alertItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    backgroundColor: "rgba(251, 146, 60, 0.1)",
    borderRadius: 8,
  },
  alertText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Roboto_400Regular",
    color: "#92400E",
  },
  suggestionsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  suggestionsList: {
    gap: 12,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  suggestionBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#F59E0B",
    marginTop: 6,
    flexShrink: 0,
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Roboto_400Regular",
    color: "#0F172A",
    lineHeight: 20,
  },
});
