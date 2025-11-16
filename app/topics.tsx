import { useState, useEffect } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { generateTopics, GeneratedTopic } from "../lib/ai-service";
import { getTopics, storeTopics, Topic } from "../lib/storage";
import { getTopicsFromDB, saveTopicsToDB, deleteTopicsFromDB } from "../lib/topics-service";
import { useMLRecommendation } from "../hooks/use-ml-recommendation";

export default function TopicsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ subject?: string }>();
  const subject = (params.subject || "math").toString();
  
  const { recommendation } = useMLRecommendation(subject);
  
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [learningType, setLearningType] = useState<'visual' | 'audio' | 'text'>('text');
  const [isSharedTopics, setIsSharedTopics] = useState(false);

  // Get best learning type from ML recommendation
  // The ML service now provides bestPerformingMode which identifies the mode
  // where the user has the highest average quiz score (what they excel in)
  const getBestLearningType = (): 'visual' | 'audio' | 'text' => {
    // Use bestPerformingMode from ML service (highest quiz score)
    // Fallback to recommendedMode if bestPerformingMode not available
    if (recommendation?.bestPerformingMode) {
      return recommendation.bestPerformingMode as 'visual' | 'audio' | 'text';
    }
    if (recommendation?.recommendedMode) {
      return recommendation.recommendedMode as 'visual' | 'audio' | 'text';
    }
    return 'text'; // Default fallback
  };

  // Load topics from database (with AsyncStorage fallback) or generate new ones
  useEffect(() => {
    const loadTopics = async () => {
      try {
        setLoading(true);
        
        // Get best learning type from ML recommendation first
        const bestType = getBestLearningType();
        setLearningType(bestType);
        
        // Try to load from database first (with learning type for shared topics lookup)
        try {
          const dbTopics = await getTopicsFromDB(subject, bestType);
          if (dbTopics && dbTopics.topics.length > 0) {
            // Use topics from database (could be user's own or shared)
            setTopics(dbTopics.topics);
            setLearningType(dbTopics.learningType || bestType);
            setIsSharedTopics(dbTopics.isShared || false);
            
            // Log if using shared topics
            if (dbTopics.isShared) {
              console.log(`Using shared topics from other users with ${bestType} learning type`);
            }
            
            // Also cache in AsyncStorage for offline access
            await storeTopics(subject, dbTopics.topics, dbTopics.learningType || bestType);
            return; // Exit early - topics already exist
          }
        } catch (dbError: any) {
          // If error is 404 or "not found", continue to generate
          if (dbError.message?.includes('404') || dbError.message?.includes('not found')) {
            console.log("No topics found in database (user's own or shared), will generate new ones");
          } else {
            console.warn("Failed to load from database, trying local storage:", dbError);
          }
        }
        
        // Fallback to AsyncStorage
        const stored = await getTopics(subject);
        if (stored && stored.topics.length > 0) {
          // Use stored topics from local storage
          setTopics(stored.topics);
          setLearningType(stored.learningType);
          setIsSharedTopics(false); // Local storage topics are user's own
          // Try to sync to database in background (but don't fail if topics already exist)
          saveTopicsToDB(subject, stored.topics, stored.learningType).catch(err => {
            // If topics already exist, that's fine - just log it
            if (err.message?.includes('already exist') || err.message?.includes('duplicate')) {
              console.log("Topics already exist in database, using local cache");
            } else {
              console.warn("Failed to sync topics to database:", err);
            }
          });
        } else {
          // Generate new topics based on best learning type
          const bestType = getBestLearningType();
          setLearningType(bestType);
          setIsSharedTopics(false); // Newly generated topics are user's own
          await generateAndStoreTopics(bestType);
        }
      } catch (error: any) {
        console.error("Error loading topics:", error);
        Alert.alert("Error", error.message || "Failed to load topics");
      } finally {
        setLoading(false);
      }
    };

    // Wait for recommendation to be available
    if (recommendation !== undefined) {
      loadTopics();
    }
  }, [subject, recommendation]);

  const generateAndStoreTopics = async (type: 'visual' | 'audio' | 'text') => {
    try {
      setGenerating(true);
      
      // First check if topics already exist in database (user's own or shared)
      try {
        const existingTopics = await getTopicsFromDB(subject, type);
        if (existingTopics && existingTopics.topics.length > 0) {
          // Topics already exist - use them instead of generating new ones
          setTopics(existingTopics.topics);
          setLearningType(existingTopics.learningType || type);
          setIsSharedTopics(existingTopics.isShared || false);
          
          // Log if using shared topics
          if (existingTopics.isShared) {
            console.log(`Using shared topics from other users with ${type} learning type`);
          }
          
          // Cache in AsyncStorage
          await storeTopics(subject, existingTopics.topics, existingTopics.learningType || type);
          return; // Exit early - no need to generate
        }
      } catch (checkError: any) {
        // If error is 404 or "not found", continue to generate
        if (!checkError.message?.includes('404') && !checkError.message?.includes('not found')) {
          console.warn("Error checking existing topics:", checkError);
        }
      }
      
      // Generate new topics
      const generated = await generateTopics(subject, type, 10);
      
      // Convert GeneratedTopic to Topic format
      const topicsToStore: Topic[] = generated.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        learningType: t.learningType,
        difficulty: t.difficulty,
        createdAt: t.createdAt,
      }));
      
      // Save to database (primary storage)
      try {
        const result = await saveTopicsToDB(subject, topicsToStore, type);
        // If the response indicates topics already exist, load them instead
        if (result?.alreadyExists && result?.topics) {
          setTopics(result.topics);
          setLearningType(result.learningType || type);
          await storeTopics(subject, result.topics, result.learningType || type);
          return;
        }
      } catch (dbError: any) {
        // If error is about existing topics, try to load them
        if (dbError.message?.includes('already exist') || dbError.message?.includes('duplicate')) {
          try {
            const existingTopics = await getTopicsFromDB(subject);
            if (existingTopics && existingTopics.topics.length > 0) {
              setTopics(existingTopics.topics);
              setLearningType(existingTopics.learningType || type);
              await storeTopics(subject, existingTopics.topics, existingTopics.learningType || type);
              return;
            }
          } catch (loadError) {
            console.warn("Failed to load existing topics:", loadError);
          }
        }
        console.warn("Failed to save to database, using local storage only:", dbError);
      }
      
      // Also save to AsyncStorage (fallback/offline cache)
      await storeTopics(subject, topicsToStore, type);
      
      setTopics(topicsToStore);
      setLearningType(type);
      setIsSharedTopics(false); // Newly generated topics are user's own
    } catch (error: any) {
      console.error("Error generating topics:", error);
      // Don't show error if topics already exist
      if (!error.message?.includes('already exist') && !error.message?.includes('duplicate')) {
        Alert.alert("Error", error.message || "Failed to generate topics");
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerate = async () => {
    Alert.alert(
      "Regenerate Topics",
      "This will generate new topics based on your current learning performance. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Regenerate",
          onPress: async () => {
            try {
              // Delete existing topics from database
              try {
                await deleteTopicsFromDB(subject);
              } catch (dbError) {
                console.warn("Failed to delete from database:", dbError);
              }
              
              // Clear local storage
              const { clearTopics } = await import("../lib/storage");
              await clearTopics(subject);
              
              // Generate new topics
              const bestType = getBestLearningType();
              await generateAndStoreTopics(bestType);
            } catch (error: any) {
              console.error("Error regenerating topics:", error);
              Alert.alert("Error", error.message || "Failed to regenerate topics");
            }
          },
        },
      ]
    );
  };

  const handleTopicPress = (topic: Topic) => {
    router.push({
      pathname: "/module",
      params: {
        subject: subject,
        topic: topic.title,
        learningType: topic.learningType,
      },
    });
  };

  const getLearningTypeIcon = (type: 'visual' | 'audio' | 'text') => {
    switch (type) {
      case 'visual':
        return 'eye';
      case 'audio':
        return 'headphones';
      case 'text':
        return 'book-open-variant';
      default:
        return 'book';
    }
  };

  const getLearningTypeColor = (type: 'visual' | 'audio' | 'text') => {
    switch (type) {
      case 'visual':
        return '#06B6D4';
      case 'audio':
        return '#F97316';
      case 'text':
        return '#A855F7';
      default:
        return '#64748B';
    }
  };

  const getDifficultyColor = (difficulty?: 'easy' | 'medium' | 'hard') => {
    switch (difficulty) {
      case 'easy':
        return '#10B981';
      case 'medium':
        return '#F59E0B';
      case 'hard':
        return '#EF4444';
      default:
        return '#64748B';
    }
  };

  if (loading) {
    return (
      <LinearGradient
        colors={["#F4F8FF", "#FFFFFF"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.background}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0EA5E9" />
            <Text style={styles.loadingText}>Loading topics...</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
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
          {/* Header */}
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="chevron-left" size={24} color="#0F172A" />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>Topics</Text>
              <Text style={styles.headerSubtitle}>{subject.charAt(0).toUpperCase() + subject.slice(1)}</Text>
            </View>
            <TouchableOpacity
              style={styles.regenerateButton}
              onPress={handleRegenerate}
              disabled={generating}
              activeOpacity={0.8}
            >
              {generating ? (
                <ActivityIndicator size="small" color="#0EA5E9" />
              ) : (
                <MaterialCommunityIcons name="refresh" size={20} color="#0EA5E9" />
              )}
            </TouchableOpacity>
          </View>

          {/* Learning Type Badge */}
          <View style={styles.learningTypeBadge}>
            <MaterialCommunityIcons
              name={getLearningTypeIcon(learningType) as never}
              size={20}
              color={getLearningTypeColor(learningType)}
            />
            <Text style={styles.learningTypeText}>
              Optimized for {learningType.charAt(0).toUpperCase() + learningType.slice(1)} Learning
            </Text>
            {isSharedTopics && (
              <View style={styles.sharedBadge}>
                <MaterialCommunityIcons name="account-multiple" size={14} color="#10B981" />
                <Text style={styles.sharedBadgeText}>Shared</Text>
              </View>
            )}
          </View>

          {/* Topics List */}
          {topics.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="book-open-outline" size={64} color="#CBD5E1" />
              <Text style={styles.emptyText}>No topics available</Text>
              <Text style={styles.emptySubtext}>Tap refresh to generate topics</Text>
            </View>
          ) : (
            <View style={styles.topicsContainer}>
              {topics.map((topic) => (
                <TouchableOpacity
                  key={topic.id}
                  style={styles.topicCard}
                  onPress={() => handleTopicPress(topic)}
                  activeOpacity={0.7}
                >
                  <View style={styles.topicCardHeader}>
                    <View style={styles.topicIconContainer}>
                      <MaterialCommunityIcons
                        name={getLearningTypeIcon(topic.learningType) as never}
                        size={24}
                        color={getLearningTypeColor(topic.learningType)}
                      />
                    </View>
                    <View style={styles.topicContent}>
                      <Text style={styles.topicTitle} numberOfLines={2}>
                        {topic.title}
                      </Text>
                      {topic.description && (
                        <Text style={styles.topicDescription} numberOfLines={2}>
                          {topic.description}
                        </Text>
                      )}
                    </View>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={20}
                      color="#CBD5E1"
                    />
                  </View>
                  {topic.difficulty && (
                    <View style={styles.topicFooter}>
                      <View
                        style={[
                          styles.difficultyBadge,
                          { backgroundColor: `${getDifficultyColor(topic.difficulty)}20` },
                        ]}
                      >
                        <View
                          style={[
                            styles.difficultyDot,
                            { backgroundColor: getDifficultyColor(topic.difficulty) },
                          ]}
                        />
                        <Text
                          style={[
                            styles.difficultyText,
                            { color: getDifficultyColor(topic.difficulty) },
                          ]}
                        >
                          {topic.difficulty.charAt(0).toUpperCase() + topic.difficulty.slice(1)}
                        </Text>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
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
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    fontFamily: "Roboto_400Regular",
    color: "#64748B",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: "Montserrat_700Bold",
    color: "#0F172A",
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: "Roboto_400Regular",
    color: "#64748B",
    marginTop: 2,
  },
  regenerateButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  learningTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  learningTypeText: {
    fontSize: 14,
    fontFamily: "Roboto_500Medium",
    color: "#0F172A",
    flex: 1,
  },
  sharedBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#D1FAE5",
    borderRadius: 8,
  },
  sharedBadgeText: {
    fontSize: 11,
    fontFamily: "Roboto_500Medium",
    color: "#10B981",
    marginLeft: 4,
  },
  topicsContainer: {
    gap: 12,
  },
  topicCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  topicCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  topicIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  topicContent: {
    flex: 1,
  },
  topicTitle: {
    fontSize: 16,
    fontFamily: "Montserrat_600SemiBold",
    color: "#0F172A",
    marginBottom: 4,
  },
  topicDescription: {
    fontSize: 13,
    fontFamily: "Roboto_400Regular",
    color: "#64748B",
    lineHeight: 18,
  },
  topicFooter: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  difficultyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  difficultyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  difficultyText: {
    fontSize: 11,
    fontFamily: "Roboto_500Medium",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 80,
    gap: 16,
  },
  emptyText: {
    fontSize: 18,
    fontFamily: "Montserrat_600SemiBold",
    color: "#64748B",
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: "Roboto_400Regular",
    color: "#94A3B8",
  },
});

