import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAIContent } from "../hooks/use-ai-content";
import { useEngagement } from "../hooks/use-engagement";
import { useMLRecommendation } from "../hooks/use-ml-recommendation";
import { generateQuiz, QuizQuestion, QuizResponse } from "../lib/ai-service";
import { getApiBaseUrl } from "../lib/api";
import { getLatestQuizResult, saveQuizAttempt } from "../lib/quiz-service";

// Import expo-audio and expo-video
let Audio: any = null;
let VideoView: any = null;
let useVideoPlayer: any = null;
try {
  const expoAudio = require("expo-audio");
  Audio = expoAudio.Audio;
} catch (error) {
  console.warn("expo-audio not available");
}
try {
  const expoVideo = require("expo-video");
  VideoView = expoVideo.VideoView;
  useVideoPlayer = expoVideo.useVideoPlayer;
} catch (error) {
  console.warn("expo-video not available");
}

export default function ModulePage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ subject?: string; topic?: string; learningType?: string }>();
  const subject = (params.subject || "math").toString();
  const topic = (params.topic || "Introduction").toString();
  
  const [activeTab, setActiveTab] = useState<'overview' | 'quiz'>('overview');
  const [expandedSections, setExpandedSections] = useState<{ [key: number]: boolean }>({});
  
  // Quiz state
  const [quiz, setQuiz] = useState<QuizResponse | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [quizResults, setQuizResults] = useState<any>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  
  // Get ML recommendation to determine learning type
  const { recommendation } = useMLRecommendation(subject);
  const { content, loading: contentLoading, error: contentError, generateForMode } = useAIContent();
  const { engagement } = useEngagement(7);
  
  // Determine the learning type to use (from ML or params)
  const learningType = (() => {
    if (params.learningType) {
      return params.learningType.toLowerCase() as 'visual' | 'audio' | 'text';
    }
    if (recommendation?.bestPerformingMode) {
      return recommendation.bestPerformingMode as 'visual' | 'audio' | 'text';
    }
    if (recommendation?.recommendedMode) {
      return recommendation.recommendedMode as 'visual' | 'audio' | 'text';
    }
    return 'text'; // Default to text based on image
  })();
  
  // Audio player state
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const audioRefs = useRef<{ [key: string]: any }>({});
  
  // Helper to get media URLs
  const getMediaUrl = (path: string): string => {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    const API_URL = getApiBaseUrl();
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${API_URL}${normalizedPath}`;
  };
  
  // Load content when component mounts
  useEffect(() => {
    if (subject && topic && learningType && recommendation !== undefined) {
      generateForMode(subject, topic, learningType, 'medium');
    }
  }, [subject, topic, learningType, recommendation]);
  
  // Load quiz or saved results when quiz tab is active
  useEffect(() => {
    if (activeTab === 'quiz' && subject && topic && learningType && !quiz && !quizLoading && !quizResults) {
      loadQuizOrResults();
    }
  }, [activeTab, subject, topic, learningType]);
  
  const loadQuizOrResults = async () => {
    try {
      setQuizLoading(true);
      
      // First, check if there's a saved quiz result for this topic
      try {
        const savedResult = await getLatestQuizResult(subject, topic);
        if (savedResult.result && savedResult.responses) {
          // Convert saved result to display format
          const formattedResults = savedResult.responses.map((r: any) => ({
            question: r.question_text,
            userAnswer: r.user_answer,
            correctAnswer: r.correct_answer,
            isCorrect: r.is_correct,
            explanation: r.explanation,
          }));
          
          setQuizResults({
            score: parseFloat(savedResult.result.score),
            correct: savedResult.result.correct_answers,
            total: savedResult.result.total_questions,
            results: formattedResults,
            learningType: savedResult.result.learning_type,
          });
          
          console.log("✅ Loaded saved quiz result");
          setQuizLoading(false);
          return;
        }
      } catch (error: any) {
        console.log("No saved quiz result found, generating new quiz:", error.message);
        // Continue to generate new quiz if no saved result
      }
      
      // If no saved result, generate new quiz
      // Pass the actual content to ensure questions are based on what was taught
      const quizData = await generateQuiz(subject, topic, learningType, 'medium', 5, content || null);
      setQuiz(quizData);
    } catch (error: any) {
      console.error("Failed to load quiz:", error);
      Alert.alert("Error", error.message || "Failed to load quiz");
    } finally {
      setQuizLoading(false);
    }
  };
  
  const loadQuiz = async () => {
    try {
      setQuizLoading(true);
      // Pass the actual content to ensure questions are based on what was taught
      const quizData = await generateQuiz(subject, topic, learningType, 'medium', 5, content || null);
      setQuiz(quizData);
      // Clear any existing results when loading a new quiz
      setQuizResults(null);
      setQuizAnswers({});
    } catch (error: any) {
      console.error("Failed to generate quiz:", error);
      Alert.alert("Error", error.message || "Failed to generate quiz");
    } finally {
      setQuizLoading(false);
    }
  };
  
  const handleAnswerChange = (questionId: number, answer: string) => {
    setQuizAnswers(prev => ({ ...prev, [questionId]: answer }));
  };
  
  const handleSubmitQuiz = async () => {
    if (!quiz) return;
    
    try {
      setQuizSubmitting(true);
      
      // Calculate score
      let correct = 0;
      const results = quiz.questions.map((q: QuizQuestion) => {
        const userAnswer = quizAnswers[q.id];
        const isCorrect = userAnswer === q.correctAnswer;
        if (isCorrect) correct++;
        return {
          question: q.question,
          userAnswer,
          correctAnswer: q.correctAnswer,
          isCorrect,
          explanation: q.explanation,
        };
      });
      
      const score = (correct / quiz.questions.length) * 100;
      
      // Prepare quiz response data for database
      const quizResponses = quiz.questions.map((q: QuizQuestion, index: number) => ({
        question_id: q.id || index,
        question_text: q.question,
        question_type: q.type || "multiple_choice",
        user_answer: quizAnswers[q.id] || null,
        correct_answer: q.correctAnswer,
        is_correct: quizAnswers[q.id] === q.correctAnswer,
        explanation: q.explanation || null,
      }));
      
      // Save quiz to dedicated quiz_results table only
      // Note: We don't save to activity_logs here since this is for topics where
      // the learning type has already been determined by ML
      try {
        const quizResult = await saveQuizAttempt(
          subject,
          topic,
          learningType,
          quiz.questions.length,
          correct,
          score,
          quizResponses,
          'medium'
        );
        console.log("✅ Quiz saved to quiz_results table successfully!", quizResult);
      } catch (quizError: any) {
        console.error("Error saving quiz to quiz_results table:", quizError);
        // Continue even if quiz table save fails - still show results
      }
      
      // Set results
      setQuizResults({
        score,
        correct,
        total: quiz.questions.length,
        results,
        learningType,
      });
      
      Alert.alert(
        "Quiz Submitted!",
        `You scored ${Math.round(score)}% (${correct}/${quiz.questions.length} correct)`,
        [{ text: "OK" }]
      );
    } catch (error: any) {
      console.error("Error submitting quiz:", error);
      Alert.alert("Error", error.message || "Failed to submit quiz");
    } finally {
      setQuizSubmitting(false);
    }
  };
  
  const handleRetryQuiz = () => {
    setQuiz(null);
    setQuizAnswers({});
    setQuizResults(null);
    loadQuiz();
  };
  
  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      Object.values(audioRefs.current).forEach((sound) => {
        if (sound && sound.unloadAsync) {
          sound.unloadAsync().catch(console.error);
        }
      });
    };
  }, []);
  
  // Extract keywords from text content for highlighting
  const highlightKeywords = (text: string, keywords: string[] = []): React.ReactNode[] => {
    if (!keywords || keywords.length === 0) {
      return [<Text key="text">{text}</Text>];
    }
    
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const lowerText = text.toLowerCase();
    
    keywords.forEach((keyword, idx) => {
      const lowerKeyword = keyword.toLowerCase();
      const keywordIndex = lowerText.indexOf(lowerKeyword, lastIndex);
      
      if (keywordIndex !== -1) {
        // Add text before keyword
        if (keywordIndex > lastIndex) {
          parts.push(<Text key={`before-${idx}`}>{text.substring(lastIndex, keywordIndex)}</Text>);
        }
        // Add highlighted keyword
        parts.push(
          <Text key={`keyword-${idx}`} style={styles.highlightedKeyword}>
            {text.substring(keywordIndex, keywordIndex + keyword.length)}
          </Text>
        );
        lastIndex = keywordIndex + keyword.length;
      }
    });
    
    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(<Text key="remaining">{text.substring(lastIndex)}</Text>);
    }
    
    return parts.length > 0 ? parts : [<Text key="text">{text}</Text>];
  };
  
  // Calculate reading time (rough estimate: 200 words per minute)
  const calculateReadingTime = (content: string): number => {
    const words = content.split(/\s+/).length;
    return Math.ceil(words / 200);
  };
  
  // Extract key concepts for the topic diagram
  const getTopicKeyConcepts = (): string[] => {
    if (!content) return [];
    
    const concepts: string[] = [];
    
    // Extract from text sections
    if (content.sections) {
      content.sections.forEach((section) => {
        if (section.keyConcepts) {
          concepts.push(...section.keyConcepts);
        }
        // Extract from heading
        if (section.heading) {
          concepts.push(section.heading);
        }
      });
    }
    
    // Extract from visual elements
    if (content.visualElements) {
      content.visualElements.forEach((element) => {
        if (element.type) concepts.push(element.type);
      });
    }
    
    // Extract from practice problems
    if (content.practiceProblems) {
      content.practiceProblems.slice(0, 2).forEach((problem) => {
        // Extract key terms from problem
        const words = problem.problem.split(/\s+/).filter(w => w.length > 4);
        concepts.push(...words.slice(0, 1));
      });
    }
    
    // Remove duplicates and limit to 4-6 concepts
    const uniqueConcepts = Array.from(new Set(concepts))
      .filter(c => c && c.length > 2)
      .slice(0, 6);
    
    return uniqueConcepts.length > 0 ? uniqueConcepts : [topic];
  };
  
  // Render topic introduction diagram
  const renderTopicDiagram = () => {
    const keyConcepts = getTopicKeyConcepts();
    const nodeColors = ['#F59E0B', '#3B82F6', '#EF4444', '#8B5CF6', '#10B981', '#06B6D4'];
    
    if (keyConcepts.length === 0) {
      // Fallback to simple topic representation
      return (
        <View style={styles.diagramPlaceholder}>
          <View style={styles.topicCenterCircle}>
            <Text style={styles.topicCenterText} numberOfLines={2}>
              {topic.split(' ').slice(0, 2).join('\n')}
            </Text>
          </View>
        </View>
      );
    }
    
    // Create a concept map with the topic in center and key concepts around it
    const centerConcept = topic.split(' ').slice(0, 3).join(' ');
    const surroundingConcepts = keyConcepts.slice(0, Math.min(4, keyConcepts.length));
    
    return (
      <View style={styles.diagramPlaceholder}>
        {/* Center topic - centered using flexbox */}
        <View style={styles.topicCenterCircle}>
          <Text style={styles.topicCenterText} numberOfLines={2}>
            {centerConcept}
          </Text>
        </View>
        
        {/* Surrounding key concepts - positioned around center */}
        {surroundingConcepts.map((concept, index) => {
          const angle = (index * 360) / surroundingConcepts.length - 90; // Start from top
          const radius = 55;
          const containerCenter = 70; // Approximate center of circular container
          const nodeSize = 35; // Half of 70px node width
          const x = containerCenter + Math.cos((angle * Math.PI) / 180) * radius - nodeSize;
          const y = containerCenter + Math.sin((angle * Math.PI) / 180) * radius - nodeSize;
          const color = nodeColors[index % nodeColors.length];
          
          return (
            <View
              key={index}
              style={[
                styles.conceptNode,
                {
                  position: 'absolute',
                  left: x,
                  top: y,
                  backgroundColor: `${color}20`,
                  borderColor: color,
                },
              ]}
            >
              <Text style={[styles.conceptNodeText, { color }]} numberOfLines={2}>
                {concept.length > 8 ? concept.substring(0, 8) + '...' : concept}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#0EA5E9" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{subject.charAt(0).toUpperCase() + subject.slice(1)}</Text>
        <TouchableOpacity 
          style={styles.bookmarkButton}
          activeOpacity={0.7}
        >
          <Ionicons name="bookmark-outline" size={24} color="#0EA5E9" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Text style={styles.pageTitle}>{topic}</Text>
        
        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'overview' && styles.tabActive]}
            onPress={() => setActiveTab('overview')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>
              Overview
            </Text>
            {activeTab === 'overview' && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'quiz' && styles.tabActive]}
            onPress={() => setActiveTab('quiz')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'quiz' && styles.tabTextActive]}>
              Quiz
            </Text>
            {activeTab === 'quiz' && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        </View>

        {/* Content Area */}
        {activeTab === 'overview' ? (
          <View style={styles.contentArea}>
            {contentLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#0EA5E9" />
                <Text style={styles.loadingText}>Generating content...</Text>
              </View>
            ) : contentError ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>Error: {contentError}</Text>
              </View>
            ) : content ? (
              <>
                {/* Top Section: Diagram and Recommendation */}
                <View style={styles.topSection}>
                  {/* Visual Diagram (Left) - Topic Introduction */}
                  <View style={styles.diagramContainer}>
                    {learningType === 'visual' && content.visualElements && content.visualElements[0]?.imageUrl ? (
                      <Image 
                        source={{ uri: getMediaUrl(content.visualElements[0].imageUrl) }}
                        style={styles.diagram}
                        resizeMode="contain"
                      />
                    ) : (
                      renderTopicDiagram()
                    )}
                  </View>
                  
                  {/* Recommendation Box (Right) */}
                  <View style={styles.recommendationBox}>
                    <View style={styles.recommendationHeader}>
                      <MaterialCommunityIcons 
                        name={learningType === 'visual' ? 'eye' : learningType === 'audio' ? 'headphones' : 'book-open-variant'} 
                        size={24} 
                        color="#10B981" 
                        style={styles.recommendationIcon}
                      />
                      <Text style={styles.recommendationTitle}>
                        Recommended: {learningType.charAt(0).toUpperCase() + learningType.slice(1)} Mode
                      </Text>
                    </View>
                    <Text style={styles.recommendationSubtext}>
                      {learningType === 'text' 
                        ? 'Switched based on your reading speed'
                        : learningType === 'audio'
                        ? 'Optimized for your audio learning performance'
                        : 'Optimized for your visual learning performance'}
                    </Text>
                  </View>
                </View>

                {/* Main Content */}
                <View style={styles.mainContent}>
                  {/* Reading Time */}
                  <View style={styles.readingTimeContainer}>
                    <Text style={styles.readingTime}>
                      {content.sections 
                        ? `${calculateReadingTime(content.sections.map(s => s.content).join(' '))} min read`
                        : '4 min read'}
                    </Text>
                  </View>

                  {/* Text Content with Highlighted Keywords */}
                  {learningType === 'text' && content.sections ? (
                    <View style={styles.textContent}>
                      {content.sections.map((section, index) => {
                        const isExpanded = expandedSections[index] !== false; // Default to expanded
                        return (
                          <View key={index} style={styles.textSection}>
                            <View style={styles.sectionHeader}>
                              {section.heading && (
                                <Text style={styles.sectionHeading}>{section.heading}</Text>
                              )}
                              <View style={styles.expandButtons}>
                                <TouchableOpacity
                                  style={styles.expandButton}
                                  onPress={() => setExpandedSections({ ...expandedSections, [index]: !isExpanded })}
                                  activeOpacity={0.7}
                                >
                                  <Ionicons 
                                    name={isExpanded ? "remove-circle" : "add-circle"} 
                                    size={24} 
                                    color={colors.primary} 
                                  />
                                </TouchableOpacity>
                              </View>
                            </View>
                            {isExpanded && (
                              <>
                                <Text style={styles.sectionText}>
                                  {highlightKeywords(
                                    section.content,
                                    section.keyConcepts || []
                                  )}
                                </Text>
                                {section.examples && section.examples.length > 0 && (
                                  <View style={styles.examplesContainer}>
                                    {section.examples.map((example, i) => (
                                      <View key={i} style={styles.exampleItem}>
                                        <Text style={styles.exampleText}>{example.example}</Text>
                                        <Text style={styles.exampleExplanation}>{example.explanation}</Text>
                                      </View>
                                    ))}
                                  </View>
                                )}
                              </>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  ) : learningType === 'visual' && content.visualElements ? (
                    <View style={styles.visualContent}>
                      {content.visualElements.map((element, index) => (
                        <View key={index} style={styles.visualElement}>
                          <Text style={styles.visualElementTitle}>{element.type}</Text>
                          <Text style={styles.visualElementDescription}>{element.description}</Text>
                          <Text style={styles.visualElementContent}>{element.content}</Text>
                        </View>
                      ))}
                    </View>
                  ) : learningType === 'audio' && content.mainContent ? (
                    <View style={styles.audioContent}>
                      {content.audioIntroduction && (
                        <Text style={styles.audioIntroduction}>{content.audioIntroduction}</Text>
                      )}
                      {content.mainContent.map((section, index) => (
                        <View key={index} style={styles.audioSection}>
                          <Text style={styles.audioSectionTitle}>{section.section}</Text>
                          <Text style={styles.audioScript}>{section.audioScript}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.noContentText}>Content is being prepared...</Text>
                  )}
                </View>
              </>
            ) : (
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="book-off" size={48} color="#94A3B8" />
                <Text style={styles.emptyText}>No content available</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.quizContainer}>
            {quizLoading ? (
              <View style={styles.quizLoadingContainer}>
                <ActivityIndicator size="large" color="#0EA5E9" />
                <Text style={styles.quizLoadingText}>Generating quiz...</Text>
              </View>
            ) : quizResults ? (
              <ScrollView style={styles.quizResultsContainer}>
                <View style={styles.quizResultsCard}>
                  <MaterialCommunityIcons
                    name={quizResults.score >= 80 ? "check-circle" : "alert-circle"}
                    size={64}
                    color={quizResults.score >= 80 ? "#10B981" : "#F59E0B"}
                  />
                  <Text style={styles.quizResultsTitle}>
                    {quizResults.score >= 80 ? "Excellent!" : "Good Try!"}
                  </Text>
                  <Text style={styles.quizResultsScore}>
                    Score: {Math.round(quizResults.score)}%
                  </Text>
                  <Text style={styles.quizResultsSubtext}>
                    {quizResults.correct} out of {quizResults.total} questions correct
                  </Text>
                  
                  <View style={styles.quizResultsDetails}>
                    {quizResults.results.map((result: any, index: number) => (
                      <View key={index} style={styles.quizResultItem}>
                        <View style={styles.quizResultHeader}>
                          <MaterialCommunityIcons
                            name={result.isCorrect ? "check-circle" : "close-circle"}
                            size={20}
                            color={result.isCorrect ? "#10B981" : "#EF4444"}
                          />
                          <Text style={styles.quizResultQuestion} numberOfLines={2}>
                            {result.question}
                          </Text>
                        </View>
                        <Text style={styles.quizResultAnswer}>
                          Your answer: {result.userAnswer || "Not answered"}
                        </Text>
                        <Text style={styles.quizResultCorrect}>
                          Correct answer: {result.correctAnswer}
                        </Text>
                        {result.explanation && (
                          <Text style={styles.quizResultExplanation}>
                            💡 {result.explanation}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                  
                  <TouchableOpacity
                    style={styles.retryQuizButton}
                    onPress={handleRetryQuiz}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.retryQuizButtonText}>Retry Quiz</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            ) : quiz ? (
              <ScrollView style={styles.quizScrollView}>
                <View style={styles.quizCard}>
                  <Text style={styles.quizCardTitle}>Test Your Understanding</Text>
                  <Text style={styles.quizCardSubtitle}>
                    Answer the questions to check your learning progress
                  </Text>
                  
                  {quiz.questions.map((question: QuizQuestion, index: number) => (
                    <View key={question.id} style={styles.questionContainer}>
                      <Text style={styles.questionNumber}>
                        Question {index + 1} of {quiz.questions.length}
                      </Text>
                      <Text style={styles.questionText}>{question.question}</Text>
                      
                      {question.type === "multiple_choice" && question.options && (
                        <View style={styles.optionsContainer}>
                          {question.options.map((option: string, i: number) => (
                            <TouchableOpacity
                              key={i}
                              style={[
                                styles.optionButton,
                                quizAnswers[question.id] === option && styles.optionButtonSelected
                              ]}
                              onPress={() => handleAnswerChange(question.id, option)}
                              activeOpacity={0.7}
                            >
                              <Text style={[
                                styles.optionText,
                                quizAnswers[question.id] === option && styles.optionTextSelected
                              ]}>
                                {option}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                      
                      {question.type === "true_false" && (
                        <View style={styles.optionsContainer}>
                          <TouchableOpacity
                            style={[
                              styles.optionButton,
                              quizAnswers[question.id] === "True" && styles.optionButtonSelected
                            ]}
                            onPress={() => handleAnswerChange(question.id, "True")}
                            activeOpacity={0.7}
                          >
                            <Text style={[
                              styles.optionText,
                              quizAnswers[question.id] === "True" && styles.optionTextSelected
                            ]}>
                              True
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.optionButton,
                              quizAnswers[question.id] === "False" && styles.optionButtonSelected
                            ]}
                            onPress={() => handleAnswerChange(question.id, "False")}
                            activeOpacity={0.7}
                          >
                            <Text style={[
                              styles.optionText,
                              quizAnswers[question.id] === "False" && styles.optionTextSelected
                            ]}>
                              False
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                      
                      {(question.type === "short_answer" || (!question.options || question.options.length === 0)) && (
                        <View style={styles.textInputContainer}>
                          <TextInput
                            style={styles.textInput}
                            placeholder="Type your answer here..."
                            placeholderTextColor="#94A3B8"
                            value={quizAnswers[question.id] || ""}
                            onChangeText={(text) => handleAnswerChange(question.id, text)}
                            multiline={false}
                            autoCapitalize="none"
                            autoCorrect={false}
                          />
                        </View>
                      )}
                      
                      {question.hint && (
                        <Text style={styles.hintText}>💡 Hint: {question.hint}</Text>
                      )}
                    </View>
                  ))}
                  
                  <TouchableOpacity
                    style={[
                      styles.submitQuizButton,
                      Object.keys(quizAnswers).length !== quiz.questions.length && styles.submitQuizButtonDisabled
                    ]}
                    onPress={handleSubmitQuiz}
                    disabled={Object.keys(quizAnswers).length !== quiz.questions.length || quizSubmitting}
                    activeOpacity={0.7}
                  >
                    {quizSubmitting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.submitQuizButtonText}>Submit Quiz</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            ) : (
              <View style={styles.quizEmptyContainer}>
                <MaterialCommunityIcons name="help-circle-outline" size={48} color="#94A3B8" />
                <Text style={styles.quizEmptyText}>No quiz available</Text>
                <TouchableOpacity
                  style={styles.loadQuizButton}
                  onPress={loadQuiz}
                  activeOpacity={0.7}
                >
                  <Text style={styles.loadQuizButtonText}>Load Quiz</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Footer Navigation */}
      <View style={styles.footer}>
        <View style={styles.footerBranding}>
          <MaterialCommunityIcons name="brain" size={20} color="#0EA5E9" style={styles.footerBrandIcon} />
          <Text style={styles.footerBrandText}>MindMorph</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const colors = {
  primary: "#0EA5E9",
  primaryLight: "#E0F2FE",
  success: "#10B981",
  successLight: "#D1FAE5",
  grayLight: "#F4F5F7",
  graySoft: "#DDE0E4",
  grayMedium: "#7E8083",
  grayDark: "#3F4347",
  white: "#FFFFFF",
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primaryLight,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.graySoft,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.primary,
  },
  bookmarkButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.grayDark,
    paddingHorizontal: 16,
    paddingTop: 16,
    marginBottom: 20,
  },
  tabsContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.graySoft,
  },
  tab: {
    paddingBottom: 12,
    marginRight: 24,
    position: "relative",
  },
  tabActive: {
    // Active state handled by indicator
  },
  tabText: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.grayMedium,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: "600",
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  contentArea: {
    backgroundColor: colors.white,
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  topSection: {
    flexDirection: "row",
    marginBottom: 24,
  },
  diagramContainer: {
    width: "45%",
    aspectRatio: 1,
    marginRight: 12,
  },
  diagramPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.successLight,
    borderRadius: 100,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
  },
  diagram: {
    width: "100%",
    height: "100%",
    borderRadius: 100,
  },
  diagramInner: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  organelle: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  topicCenterCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.success,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  topicCenterText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.white,
    textAlign: "center",
    lineHeight: 14,
  },
  conceptNode: {
    width: 70,
    minHeight: 40,
    borderRadius: 12,
    padding: 8,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 5,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  conceptNodeText: {
    fontSize: 9,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 12,
  },
  connectionLine: {
    backgroundColor: colors.graySoft,
    zIndex: 1,
  },
  recommendationBox: {
    flex: 1,
    backgroundColor: colors.successLight,
    borderRadius: 12,
    padding: 16,
    justifyContent: "center",
  },
  recommendationHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  recommendationIcon: {
    marginRight: 8,
  },
  recommendationTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.grayDark,
    flex: 1,
  },
  recommendationSubtext: {
    fontSize: 12,
    color: colors.grayMedium,
    lineHeight: 18,
  },
  mainContent: {
    marginTop: 8,
  },
  readingTimeContainer: {
    alignItems: "flex-end",
    marginBottom: 16,
  },
  readingTime: {
    fontSize: 12,
    color: colors.grayMedium,
  },
  textContent: {
    marginBottom: 20,
  },
  textSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionHeading: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.grayDark,
    flex: 1,
  },
  expandButtons: {
    flexDirection: "row",
    alignItems: "center",
  },
  expandButton: {
    marginLeft: 8,
  },
  sectionText: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.grayDark,
    marginBottom: 16,
  },
  highlightedKeyword: {
    fontWeight: "700",
    color: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  examplesContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: colors.grayLight,
    borderRadius: 12,
  },
  exampleItem: {
    marginBottom: 12,
  },
  exampleText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.grayDark,
    marginBottom: 4,
  },
  exampleExplanation: {
    fontSize: 13,
    color: colors.grayMedium,
    lineHeight: 20,
  },
  visualContent: {
    marginBottom: 20,
  },
  visualElement: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: colors.grayLight,
    borderRadius: 12,
  },
  visualElementTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.primary,
    marginBottom: 8,
  },
  visualElementDescription: {
    fontSize: 14,
    color: colors.grayDark,
    marginBottom: 8,
  },
  visualElementContent: {
    fontSize: 14,
    color: colors.grayDark,
    lineHeight: 20,
  },
  audioContent: {
    marginBottom: 20,
  },
  audioIntroduction: {
    fontSize: 16,
    color: colors.grayDark,
    marginBottom: 20,
    lineHeight: 24,
  },
  audioSection: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: colors.grayLight,
    borderRadius: 12,
  },
  audioSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.primary,
    marginBottom: 10,
  },
  audioScript: {
    fontSize: 14,
    color: colors.grayDark,
    lineHeight: 22,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.grayMedium,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  errorText: {
    fontSize: 14,
    color: "#EF4444",
    textAlign: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.grayMedium,
  },
  noContentText: {
    fontSize: 14,
    color: colors.grayMedium,
    textAlign: "center",
    paddingVertical: 40,
  },
  quizContainer: {
    backgroundColor: colors.white,
    flex: 1,
    padding: 16,
  },
  quizLoadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  quizLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.grayMedium,
  },
  quizScrollView: {
    flex: 1,
  },
  quizCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  quizCardTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.grayDark,
    marginBottom: 8,
  },
  quizCardSubtitle: {
    fontSize: 14,
    color: colors.grayMedium,
    marginBottom: 24,
  },
  questionContainer: {
    marginBottom: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.graySoft,
  },
  questionNumber: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  questionText: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.grayDark,
    marginBottom: 16,
    lineHeight: 26,
  },
  optionsContainer: {
    marginBottom: 12,
  },
  optionButton: {
    backgroundColor: colors.grayLight,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "transparent",
  },
  optionButtonSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  optionText: {
    fontSize: 16,
    color: colors.grayDark,
  },
  optionTextSelected: {
    color: colors.primary,
    fontWeight: "600",
  },
  textInputContainer: {
    marginBottom: 12,
  },
  textInput: {
    backgroundColor: colors.grayLight,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.grayDark,
    borderWidth: 2,
    borderColor: "transparent",
  },
  hintText: {
    fontSize: 13,
    color: colors.grayMedium,
    fontStyle: "italic",
    marginTop: 8,
  },
  submitQuizButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 24,
  },
  submitQuizButtonDisabled: {
    backgroundColor: colors.graySoft,
    opacity: 0.6,
  },
  submitQuizButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
  quizResultsContainer: {
    flex: 1,
  },
  quizResultsCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
  },
  quizResultsTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.grayDark,
    marginTop: 16,
    marginBottom: 8,
  },
  quizResultsScore: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.primary,
    marginBottom: 8,
  },
  quizResultsSubtext: {
    fontSize: 16,
    color: colors.grayMedium,
    marginBottom: 24,
  },
  quizResultsDetails: {
    width: "100%",
    marginBottom: 24,
  },
  quizResultItem: {
    backgroundColor: colors.grayLight,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  quizResultHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  quizResultQuestion: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: colors.grayDark,
    marginLeft: 8,
  },
  quizResultAnswer: {
    fontSize: 14,
    color: colors.grayMedium,
    marginBottom: 4,
  },
  quizResultCorrect: {
    fontSize: 14,
    color: colors.success,
    fontWeight: "600",
    marginBottom: 8,
  },
  quizResultExplanation: {
    fontSize: 13,
    color: colors.grayMedium,
    fontStyle: "italic",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.graySoft,
  },
  retryQuizButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    width: "100%",
  },
  retryQuizButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
  quizEmptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  quizEmptyText: {
    fontSize: 16,
    color: colors.grayMedium,
    marginTop: 16,
    marginBottom: 24,
  },
  loadQuizButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  loadQuizButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.graySoft,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  footerBranding: {
    flexDirection: "row",
    alignItems: "center",
  },
  footerBrandIcon: {
    marginRight: 6,
  },
  footerBrandText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary,
  },
});
