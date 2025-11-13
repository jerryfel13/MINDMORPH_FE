// Learning Type Assessment Screen
// Users can test different learning types to determine their optimal style

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAIContent } from "../hooks/use-ai-content";
import { generateQuiz } from "../lib/ai-service";
import { getRecommendedMode, MLRecommendation } from "../lib/ml-service";
import { getToken } from "../lib/storage";

// Try to import expo-av, but handle if it's not available
let Audio: any = null;
let AVPlaybackStatus: any = null;
try {
  const expoAv = require("expo-av");
  Audio = expoAv.Audio;
  AVPlaybackStatus = expoAv.AVPlaybackStatus;
} catch (error) {
  console.warn("expo-av not available, using fallback audio player");
}

const LEARNING_TYPES = [
  { 
    id: "visual", 
    label: "Visual", 
    icon: "eye",
    description: "Learn through diagrams, charts, and visual aids",
    color: "#0EA5E9"
  },
  { 
    id: "audio", 
    label: "Audio", 
    icon: "headphones",
    description: "Learn through listening, discussions, and verbal explanations",
    color: "#10B981"
  },
  { 
    id: "text", 
    label: "Text", 
    icon: "book-open-variant",
    description: "Learn through reading, written materials, and text-based content",
    color: "#8B5CF6"
  },
];

type TestStep = "selection" | "learning" | "quiz" | "results";

export default function LearningTypeTestScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ subject?: string; topic?: string }>();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<TestStep>("selection");
  const [quiz, setQuiz] = useState<any>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [quizResults, setQuizResults] = useState<any>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [mlRecommendation, setMlRecommendation] = useState<MLRecommendation | null>(null);
  const [loadingRecommendation, setLoadingRecommendation] = useState(false);
  
  const { content, loading: contentLoading, error: contentError, generateForMode } = useAIContent();
  
  const subject = params.subject || "math";
  const topic = params.topic || "Algebra Basics";

  // Helper function to safely render content (handles objects, arrays, strings)
  const renderSafeContent = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) return value.map(v => renderSafeContent(v)).join(', ');
    if (typeof value === 'object') {
      // If it's an object, try to extract meaningful text
      if (value.text) return String(value.text);
      if (value.content) return String(value.content);
      if (value.summary) return String(value.summary);
      // Otherwise, stringify it
      return JSON.stringify(value);
    }
    return String(value);
  };

  // Helper function to get full audio URL
  const getAudioUrl = (audioPath: string): string => {
    if (!audioPath) return '';
    if (audioPath.startsWith('http')) return audioPath;
    const API_URL = process.env.EXPO_PUBLIC_API_URL || `http://192.168.100.66:4000`;
    return `${API_URL}${audioPath}`;
  };

  // Audio player state
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const audioRefs = useRef<Record<string, any>>({});

  // Debug: Log audioFiles when content changes
  useEffect(() => {
    if (selectedType === "audio" && content) {
      console.log('🔍 Audio Content Debug:', {
        hasAudioFiles: !!content.audioFiles,
        audioFiles: content.audioFiles,
        hasCombinedAudio: !!content.audioFiles?.combined,
        combinedAudioUrl: content.audioFiles?.combined,
      });
    }
  }, [content, selectedType]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (Audio) {
        Object.values(audioRefs.current).forEach(sound => {
          if (sound && sound.unloadAsync) {
            sound.unloadAsync().catch(console.error);
          }
        });
      }
    };
  }, []);

  // Audio player component
  const AudioPlayer = ({ audioUrl, label }: { audioUrl: string; label: string }) => {
    const fullUrl = getAudioUrl(audioUrl);
    const isPlaying = playingAudio === fullUrl;

    const handlePlayPause = async () => {
      // Fallback: If Audio is not available, open URL in browser
      if (!Audio) {
        try {
          const canOpen = await Linking.canOpenURL(fullUrl);
          if (canOpen) {
            await Linking.openURL(fullUrl);
          } else {
            console.error('Cannot open audio URL:', fullUrl);
          }
        } catch (error) {
          console.error('Error opening audio URL:', error);
        }
        return;
      }

      try {
        if (isPlaying) {
          // Pause
          const sound = audioRefs.current[fullUrl];
          if (sound) {
            await sound.pauseAsync();
            setPlayingAudio(null);
          }
        } else {
          // Stop any currently playing audio
          if (playingAudio) {
            const currentSound = audioRefs.current[playingAudio];
            if (currentSound) {
              await currentSound.stopAsync();
              await currentSound.unloadAsync();
            }
          }

          // Play new audio
          const { sound } = await Audio.Sound.createAsync(
            { uri: fullUrl },
            { shouldPlay: true }
          );
          audioRefs.current[fullUrl] = sound;
          setPlayingAudio(fullUrl);

          // Handle playback finish
          sound.setOnPlaybackStatusUpdate((status: any) => {
            if (status.isLoaded && status.didJustFinish) {
              setPlayingAudio(null);
              sound.unloadAsync().catch(console.error);
              delete audioRefs.current[fullUrl];
            }
          });
        }
      } catch (error) {
        console.error('Audio playback error:', error);
        setPlayingAudio(null);
        // Fallback to opening URL if playback fails
        try {
          await Linking.openURL(fullUrl);
        } catch (linkError) {
          console.error('Error opening audio URL as fallback:', linkError);
        }
      }
    };

    if (!fullUrl) return null;

    return (
      <TouchableOpacity
        style={styles.audioPlayer}
        onPress={handlePlayPause}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons
          name={isPlaying ? "pause-circle" : "play-circle"}
          size={32}
          color="#10B981"
        />
        <Text style={styles.audioPlayerLabel}>{label}</Text>
        {isPlaying && <ActivityIndicator size="small" color="#10B981" style={{ marginLeft: 8 }} />}
      </TouchableOpacity>
    );
  };

  const handleSelectType = async (typeId: string) => {
    setSelectedType(typeId);
    setCurrentStep("learning");
    // Generate content for selected learning type
    try {
      await generateForMode(subject, topic, typeId as 'visual' | 'audio' | 'text', "medium");
    } catch (error) {
      console.error("Failed to generate content:", error);
      // Error is already set in the hook, will be displayed in UI
    }
  };

  const handleStartQuiz = async () => {
    if (!selectedType) return;
    
    setQuizLoading(true);
    try {
      const quizData = await generateQuiz(subject, topic, selectedType as any, "medium", 5);
      setQuiz(quizData);
      setCurrentStep("quiz");
    } catch (error) {
      console.error("Failed to generate quiz:", error);
      // Show error to user - you might want to add error state handling here
    } finally {
      setQuizLoading(false);
    }
  };

  const handleAnswerChange = (questionId: number, answer: string) => {
    setQuizAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmitQuiz = async () => {
    if (!quiz) return;
    
    // Calculate score
    let correct = 0;
    const results = quiz.questions.map((q: any) => {
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
    
    // Determine if user excels with this learning type
    const excels = score >= 80; // 80% or higher = excels
    
    setQuizResults({
      score,
      excels,
      results,
      learningType: selectedType,
    });
    
    setCurrentStep("results");
    
    // Log activity to backend (for ML analysis)
    try {
      const token = await getToken();
      if (!token) {
        console.warn("No token found, skipping activity log");
        return;
      }
      
      const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://192.168.100.66:4000";
      await fetch(`${API_URL}/activity`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          subject,
          activity_type: selectedType,
          quiz_score: Math.round(score),
          focus_level: excels ? 85 : 60,
          reading_time: 0,
          playback_time: 0,
        }),
      });
      
      // Fetch ML recommendation after logging activity
      setLoadingRecommendation(true);
      try {
        const recommendation = await getRecommendedMode(subject);
        setMlRecommendation(recommendation);
        console.log("ML Recommendation:", recommendation);
      } catch (mlError) {
        console.error("Failed to get ML recommendation:", mlError);
        // Don't block the UI if ML fails
      } finally {
        setLoadingRecommendation(false);
      }
    } catch (error) {
      console.error("Failed to log activity:", error);
    }
  };

  const handleRetry = () => {
    setSelectedType(null);
    setCurrentStep("selection");
    setQuiz(null);
    setQuizAnswers({});
    setQuizResults(null);
    setMlRecommendation(null);
  };

  const handleTryRecommendedMode = async (mode: string) => {
    // Reset and try the recommended learning type
    setSelectedType(mode);
    setCurrentStep("learning");
    setQuiz(null);
    setQuizAnswers({});
    setQuizResults(null);
    // Generate content for the recommended mode
    try {
      await generateForMode(subject, topic, mode as 'visual' | 'audio' | 'text', "medium");
    } catch (error) {
      console.error("Failed to generate content:", error);
    }
  };

  const handleContinue = () => {
    router.push({
      pathname: "/mode-switch",
      params: {
        subject,
        mode: selectedType,
      },
    });
  };

  // Selection Step
  if (currentStep === "selection") {
    return (
      <LinearGradient colors={["#EEF9FF", "#FDFEFE"]} style={styles.background}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={20} color="#0F172A" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Learning Type Assessment</Text>
            <View style={styles.backButtonPlaceholder} />
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Choose Your Learning Type</Text>
              <Text style={styles.cardSubtitle}>
                Select a learning style to test. You'll study content and take a quiz to see how well you perform with this style.
              </Text>

              <View style={styles.typesContainer}>
                {LEARNING_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.id}
                    style={[styles.typeCard, selectedType === type.id && styles.typeCardSelected]}
                    onPress={() => handleSelectType(type.id)}
                  >
                    <View style={[styles.typeIconContainer, { backgroundColor: `${type.color}20` }]}>
                      <MaterialCommunityIcons name={type.icon as any} size={32} color={type.color} />
                    </View>
                    <Text style={styles.typeLabel}>{type.label}</Text>
                    <Text style={styles.typeDescription}>{type.description}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // Quiz Loading Step
  if (quizLoading) {
    return (
      <LinearGradient colors={["#EEF9FF", "#FDFEFE"]} style={styles.background}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingFullScreen}>
            <View style={styles.loadingCard}>
              <MaterialCommunityIcons name="book-open-variant" size={64} color="#0EA5E9" />
              <Text style={styles.loadingTitle}>Crafting Your Assessment</Text>
              <Text style={styles.loadingSubtitle}>
                We're preparing personalized quiz questions tailored to your {selectedType ? selectedType.charAt(0).toUpperCase() + selectedType.slice(1) : ''} learning style. This will only take a moment...
              </Text>
              <ActivityIndicator size="large" color="#0EA5E9" style={{ marginTop: 32 }} />
              <View style={styles.loadingDots}>
                <Text style={styles.loadingDotText}>●</Text>
                <Text style={styles.loadingDotText}>●</Text>
                <Text style={styles.loadingDotText}>●</Text>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // Learning Step
  if (currentStep === "learning") {
    return (
      <LinearGradient colors={["#EEF9FF", "#FDFEFE"]} style={styles.background}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backButton} onPress={() => setCurrentStep("selection")}>
              <Ionicons name="chevron-back" size={20} color="#0F172A" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {selectedType ? selectedType.charAt(0).toUpperCase() + selectedType.slice(1) : ''} Learning
            </Text>
            <View style={styles.backButtonPlaceholder} />
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {contentLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#0EA5E9" />
                <Text style={styles.loadingText}>Generating personalized content...</Text>
              </View>
            ) : content ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{content.title || topic}</Text>
                
                {/* Visual Content */}
                {selectedType === "visual" && content.visualElements && (
                  <View>
                    {content.visualElements.map((element, index) => (
                      <View key={index} style={styles.contentSection}>
                        <Text style={styles.sectionTitle}>{renderSafeContent(element.type)}</Text>
                        <Text style={styles.contentText}>{renderSafeContent(element.description)}</Text>
                        <Text style={styles.contentText}>{renderSafeContent(element.content)}</Text>
                      </View>
                    ))}
                    {content.stepByStepGuide && (
                      <View style={styles.contentSection}>
                        <Text style={styles.sectionTitle}>Step-by-Step Guide</Text>
                        {content.stepByStepGuide.map((step, index) => (
                          <View key={index} style={styles.stepContainer}>
                            <Text style={styles.stepNumber}>Step {renderSafeContent(step.step)}</Text>
                            <Text style={styles.contentText}>{renderSafeContent(step.visualDescription)}</Text>
                            <Text style={styles.contentText}>{renderSafeContent(step.explanation)}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}

                {/* Audio Content */}
                {selectedType === "audio" && content.mainContent && (
                  <View>
                    {/* Single combined audio player at the top */}
                    {content.audioFiles?.combined ? (
                      <View style={styles.contentSection}>
                        <AudioPlayer
                          audioUrl={content.audioFiles.combined}
                          label="Listen to Complete Audio Lesson"
                        />
                      </View>
                    ) : (
                      <View style={styles.contentSection}>
                        <View style={styles.audioPlaceholder}>
                          <MaterialCommunityIcons name="volume-off" size={20} color="#94A3B8" />
                          <Text style={styles.audioPlaceholderText}>Audio not available</Text>
                        </View>
                      </View>
                    )}
                    
                    {/* Text content below */}
                    {content.audioIntroduction && (
                      <View style={styles.contentSection}>
                        <Text style={styles.sectionTitle}>Introduction</Text>
                        <Text style={styles.contentText}>{renderSafeContent(content.audioIntroduction)}</Text>
                      </View>
                    )}
                    {content.mainContent.map((section, index) => (
                      <View key={index} style={styles.contentSection}>
                        <Text style={styles.sectionTitle}>{renderSafeContent(section.section)}</Text>
                        <Text style={styles.contentText}>{renderSafeContent(section.audioScript)}</Text>
                        {section.keyPoints && Array.isArray(section.keyPoints) && (
                          <View style={styles.keyPointsContainer}>
                            {section.keyPoints.map((point, i) => (
                              <Text key={i} style={styles.keyPoint}>• {renderSafeContent(point)}</Text>
                            ))}
                          </View>
                        )}
                      </View>
                    ))}
                    {/* Summary */}
                    {content.audioSummary && (
                      <View style={styles.contentSection}>
                        <Text style={styles.sectionTitle}>Summary</Text>
                        <Text style={styles.contentText}>{renderSafeContent(content.audioSummary)}</Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Text Content */}
                {selectedType === "text" && content.sections && (
                  <View>
                    {content.sections.map((section, index) => (
                      <View key={index} style={styles.contentSection}>
                        <Text style={styles.sectionTitle}>{section.heading || `Section ${index + 1}`}</Text>
                        <Text style={styles.contentText}>{renderSafeContent(section.content)}</Text>
                        {section.keyConcepts && Array.isArray(section.keyConcepts) && (
                          <View style={styles.keyPointsContainer}>
                            {section.keyConcepts.map((concept, i) => (
                              <Text key={i} style={styles.keyPoint}>
                                • {renderSafeContent(concept)}
                              </Text>
                            ))}
                          </View>
                        )}
                        {section.examples && Array.isArray(section.examples) && section.examples.map((example, i) => (
                          <View key={i} style={styles.exampleContainer}>
                            <Text style={styles.exampleLabel}>Example:</Text>
                            <Text style={styles.contentText}>{renderSafeContent(example.example)}</Text>
                            <Text style={styles.contentText}>{renderSafeContent(example.explanation)}</Text>
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                )}

                {content.summary && (
                  <View style={styles.summaryContainer}>
                    <Text style={styles.sectionTitle}>Summary</Text>
                    <Text style={styles.contentText}>{renderSafeContent(content.summary)}</Text>
                  </View>
                )}

                <TouchableOpacity 
                  style={styles.primaryButton} 
                  onPress={handleStartQuiz}
                >
                  <Text style={styles.primaryButtonText}>I'm Ready for the Quiz</Text>
                </TouchableOpacity>
              </View>
            ) : contentError ? (
              <View style={styles.errorContainer}>
                <MaterialCommunityIcons name="alert-circle" size={48} color="#EF4444" />
                <Text style={styles.errorTitle}>Failed to Generate Content</Text>
                <Text style={styles.errorText}>{contentError}</Text>
                <Text style={styles.errorHint}>
                  Common issues:{'\n'}
                  • Check your internet connection{'\n'}
                  • Verify server is running{'\n'}
                  • Ensure OpenAI API key is configured{'\n'}
                  • Make sure you're logged in
                </Text>
                <TouchableOpacity 
                  style={styles.primaryButton} 
                  onPress={() => handleSelectType(selectedType!)}
                >
                  <Text style={styles.primaryButtonText}>Try Again</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.secondaryButton} 
                  onPress={() => setCurrentStep("selection")}
                >
                  <Text style={styles.secondaryButtonText}>Go Back</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>No content available. Please try again.</Text>
                <TouchableOpacity style={styles.secondaryButton} onPress={() => setCurrentStep("selection")}>
                  <Text style={styles.secondaryButtonText}>Go Back</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // Quiz Step
  if (currentStep === "quiz" && quiz) {
    return (
      <LinearGradient colors={["#EEF9FF", "#FDFEFE"]} style={styles.background}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backButton} onPress={() => setCurrentStep("learning")}>
              <Ionicons name="chevron-back" size={20} color="#0F172A" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Quiz</Text>
            <View style={styles.backButtonPlaceholder} />
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Test Your Understanding</Text>
              <Text style={styles.cardSubtitle}>
                Answer the questions to see how well you learned with {selectedType} learning style.
              </Text>

              {quiz.questions.map((question: any, index: number) => (
                <View key={question.id} style={styles.questionContainer}>
                  <Text style={styles.questionNumber}>Question {index + 1} of {quiz.questions.length}</Text>
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

                  {(question.type === "short_answer" || (question.type !== "multiple_choice" && question.type !== "true_false" && (!question.options || question.options.length === 0))) && (
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
                  styles.primaryButton,
                  Object.keys(quizAnswers).length !== quiz.questions.length && styles.primaryButtonDisabled
                ]}
                onPress={handleSubmitQuiz}
                disabled={Object.keys(quizAnswers).length !== quiz.questions.length}
              >
                <Text style={styles.primaryButtonText}>Submit Quiz</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // Results Step
  if (currentStep === "results" && quizResults) {
    return (
      <LinearGradient colors={["#EEF9FF", "#FDFEFE"]} style={styles.background}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backButton} onPress={handleRetry}>
              <Ionicons name="chevron-back" size={20} color="#0F172A" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Results</Text>
            <View style={styles.backButtonPlaceholder} />
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            <View style={styles.card}>
              <View style={styles.resultsHeader}>
                <MaterialCommunityIcons
                  name={quizResults.excels ? "check-circle" : "alert-circle"}
                  size={64}
                  color={quizResults.excels ? "#10B981" : "#F59E0B"}
                />
                <Text style={styles.resultsTitle}>
                  {quizResults.excels ? "Excellent!" : "Good Try!"}
                </Text>
                <Text style={styles.resultsScore}>Score: {Math.round(quizResults.score)}%</Text>
                <Text style={styles.resultsMessage}>
                  {quizResults.excels
                    ? `You excel with ${quizResults.learningType} learning! This learning style works well for you.`
                    : `You scored ${Math.round(quizResults.score)}% with ${quizResults.learningType} learning. Try another learning style to find your best match.`}
                </Text>
              </View>

              <View style={styles.resultsDetails}>
                <Text style={styles.sectionTitle}>Question Review</Text>
                {quizResults.results.map((result: any, index: number) => (
                  <View key={index} style={styles.resultItem}>
                    <View style={styles.resultHeader}>
                      <MaterialCommunityIcons
                        name={result.isCorrect ? "check" : "close"}
                        size={20}
                        color={result.isCorrect ? "#10B981" : "#EF4444"}
                      />
                      <Text style={styles.resultQuestion}>{result.question}</Text>
                    </View>
                    <Text style={styles.resultAnswer}>
                      Your answer: {result.userAnswer}
                    </Text>
                    {!result.isCorrect && (
                      <Text style={styles.resultCorrect}>
                        Correct answer: {result.correctAnswer}
                      </Text>
                    )}
                    <Text style={styles.resultExplanation}>{result.explanation}</Text>
                  </View>
                ))}
              </View>

              {/* ML Recommendation Section */}
              {mlRecommendation && (
                <View style={styles.recommendationContainer}>
                  <Text style={styles.sectionTitle}>AI Recommendation</Text>
                  <View style={styles.recommendationCard}>
                    <View style={styles.recommendationHeader}>
                      <MaterialCommunityIcons name="brain" size={24} color="#0EA5E9" />
                      <Text style={styles.recommendationTitle}>
                        Recommended: {mlRecommendation.recommendedMode.charAt(0).toUpperCase() + mlRecommendation.recommendedMode.slice(1)} Learning
                      </Text>
                    </View>
                    <Text style={styles.recommendationText}>{mlRecommendation.reasoning}</Text>
                    <Text style={styles.confidenceText}>
                      Confidence: {Math.round(mlRecommendation.confidence * 100)}%
                    </Text>
                    
                    {/* Show all learning types with recommendations */}
                    <View style={styles.learningTypesGrid}>
                      {LEARNING_TYPES.map((type) => {
                        const isRecommended = mlRecommendation.recommendedMode === type.id;
                        const isCurrent = selectedType === type.id;
                        const stats = mlRecommendation.modeStats?.[type.id as 'visual' | 'audio' | 'text'];
                        
                        return (
                          <TouchableOpacity
                            key={type.id}
                            style={[
                              styles.recommendedTypeCard,
                              isRecommended && styles.recommendedTypeCardHighlighted,
                              isCurrent && styles.recommendedTypeCardCurrent
                            ]}
                            onPress={() => handleTryRecommendedMode(type.id)}
                          >
                            <View style={[styles.typeIconContainer, { backgroundColor: `${type.color}20` }]}>
                              <MaterialCommunityIcons name={type.icon as any} size={24} color={type.color} />
                            </View>
                            <Text style={styles.recommendedTypeLabel}>{type.label}</Text>
                            {isRecommended && (
                              <View style={styles.recommendedBadge}>
                                <Text style={styles.recommendedBadgeText}>Recommended</Text>
                              </View>
                            )}
                            {isCurrent && (
                              <Text style={styles.currentBadgeText}>Current</Text>
                            )}
                            {stats && (
                              <Text style={styles.statsText}>
                                Avg Score: {Math.round(stats.totalScore / Math.max(stats.totalSessions, 1))}%
                              </Text>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </View>
              )}

              {loadingRecommendation && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#0EA5E9" />
                  <Text style={styles.loadingText}>Analyzing your performance...</Text>
                </View>
              )}

              <View style={styles.resultsActions}>
                {quizResults.excels ? (
                  <TouchableOpacity style={styles.primaryButton} onPress={handleContinue}>
                    <Text style={styles.primaryButtonText}>Continue with {quizResults.learningType} Learning</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    {mlRecommendation && mlRecommendation.recommendedMode !== selectedType && (
                      <TouchableOpacity 
                        style={styles.primaryButton} 
                        onPress={() => handleTryRecommendedMode(mlRecommendation.recommendedMode)}
                      >
                        <Text style={styles.primaryButtonText}>
                          Try {mlRecommendation.recommendedMode.charAt(0).toUpperCase() + mlRecommendation.recommendedMode.slice(1)} Learning (Recommended)
                        </Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.secondaryButton} onPress={handleRetry}>
                      <Text style={styles.secondaryButtonText}>Try Another Learning Type</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 18,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Montserrat_600SemiBold",
    color: "#0F172A",
    flex: 1,
    textAlign: "center",
  },
  backButton: {
    height: 44,
    width: 44,
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
    width: 44,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  card: {
    borderRadius: 36,
    backgroundColor: "#FFFFFF",
    padding: 28,
    shadowColor: "#BAE6FD",
    shadowOpacity: 0.35,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 10,
  },
  cardTitle: {
    fontSize: 26,
    fontFamily: "Montserrat_600SemiBold",
    color: "#0F172A",
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 14,
    fontFamily: "Roboto_400Regular",
    color: "#64748B",
    marginBottom: 24,
    lineHeight: 20,
  },
  typesContainer: {
    gap: 16,
  },
  typeCard: {
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "#E2E8F0",
    padding: 20,
    alignItems: "center",
  },
  typeCardSelected: {
    borderColor: "#0EA5E9",
    backgroundColor: "#F0F9FF",
  },
  typeIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  typeLabel: {
    fontSize: 20,
    fontFamily: "Montserrat_600SemiBold",
    color: "#0F172A",
    marginBottom: 8,
  },
  typeDescription: {
    fontSize: 14,
    fontFamily: "Roboto_400Regular",
    color: "#64748B",
    textAlign: "center",
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontFamily: "Roboto_400Regular",
    color: "#64748B",
  },
  loadingFullScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingCard: {
    borderRadius: 36,
    backgroundColor: "#FFFFFF",
    padding: 48,
    alignItems: "center",
    shadowColor: "#BAE6FD",
    shadowOpacity: 0.35,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 10,
    width: "100%",
    maxWidth: 400,
  },
  loadingTitle: {
    fontSize: 28,
    fontFamily: "Montserrat_600SemiBold",
    color: "#0F172A",
    marginTop: 24,
    marginBottom: 12,
    textAlign: "center",
  },
  loadingSubtitle: {
    fontSize: 16,
    fontFamily: "Roboto_400Regular",
    color: "#64748B",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 8,
  },
  loadingDots: {
    flexDirection: "row",
    marginTop: 24,
    gap: 8,
  },
  loadingDotText: {
    fontSize: 12,
    color: "#0EA5E9",
    opacity: 0.6,
  },
  contentSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Montserrat_600SemiBold",
    color: "#0F172A",
    marginBottom: 12,
  },
  contentText: {
    fontSize: 15,
    fontFamily: "Roboto_400Regular",
    color: "#334155",
    lineHeight: 24,
    marginBottom: 12,
  },
  audioPlayer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#10B981",
  },
  audioPlayerLabel: {
    fontSize: 15,
    fontFamily: "Montserrat_600SemiBold",
    color: "#10B981",
    marginLeft: 12,
    flex: 1,
  },
  audioPlaceholder: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  audioPlaceholderText: {
    fontSize: 14,
    fontFamily: "Roboto_400Regular",
    color: "#94A3B8",
    marginLeft: 12,
  },
  stepContainer: {
    marginBottom: 16,
    paddingLeft: 16,
    borderLeftWidth: 3,
    borderLeftColor: "#0EA5E9",
  },
  stepNumber: {
    fontSize: 16,
    fontFamily: "Montserrat_600SemiBold",
    color: "#0EA5E9",
    marginBottom: 8,
  },
  keyPointsContainer: {
    marginTop: 12,
  },
  keyPoint: {
    fontSize: 15,
    fontFamily: "Roboto_400Regular",
    color: "#334155",
    marginBottom: 8,
    lineHeight: 22,
  },
  exampleContainer: {
    backgroundColor: "#F8FAFC",
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  exampleLabel: {
    fontSize: 14,
    fontFamily: "Montserrat_600SemiBold",
    color: "#0EA5E9",
    marginBottom: 8,
  },
  summaryContainer: {
    backgroundColor: "#F0F9FF",
    padding: 20,
    borderRadius: 16,
    marginTop: 24,
  },
  questionContainer: {
    marginBottom: 32,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  questionNumber: {
    fontSize: 12,
    fontFamily: "Roboto_500Medium",
    color: "#64748B",
    marginBottom: 8,
  },
  questionText: {
    fontSize: 18,
    fontFamily: "Montserrat_600SemiBold",
    color: "#0F172A",
    marginBottom: 16,
    lineHeight: 26,
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E2E8F0",
    padding: 16,
    backgroundColor: "#FFFFFF",
  },
  optionButtonSelected: {
    borderColor: "#0EA5E9",
    backgroundColor: "#F0F9FF",
  },
  optionText: {
    fontSize: 15,
    fontFamily: "Roboto_400Regular",
    color: "#334155",
  },
  optionTextSelected: {
    color: "#0EA5E9",
    fontFamily: "Roboto_500Medium",
  },
  hintText: {
    fontSize: 13,
    fontFamily: "Roboto_400Regular",
    color: "#64748B",
    marginTop: 12,
    fontStyle: "italic",
  },
  textInputContainer: {
    marginTop: 8,
    marginBottom: 8,
  },
  textInput: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E2E8F0",
    padding: 16,
    backgroundColor: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Roboto_400Regular",
    color: "#334155",
    minHeight: 50,
  },
  primaryButton: {
    borderRadius: 999,
    backgroundColor: "#10B981",
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    shadowColor: "#10B981",
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  primaryButtonDisabled: {
    backgroundColor: "#94A3B8",
    shadowOpacity: 0,
  },
  primaryButtonText: {
    fontSize: 16,
    fontFamily: "Montserrat_600SemiBold",
    color: "#FFFFFF",
  },
  secondaryButton: {
    borderRadius: 999,
    backgroundColor: "#E2E8F0",
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontFamily: "Montserrat_600SemiBold",
    color: "#0F172A",
  },
  errorContainer: {
    alignItems: "center",
    padding: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontFamily: "Montserrat_600SemiBold",
    color: "#0F172A",
    marginTop: 16,
    marginBottom: 12,
    textAlign: "center",
  },
  errorText: {
    fontSize: 16,
    fontFamily: "Roboto_400Regular",
    color: "#EF4444",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 24,
  },
  errorHint: {
    fontSize: 14,
    fontFamily: "Roboto_400Regular",
    color: "#64748B",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  resultsHeader: {
    alignItems: "center",
    marginBottom: 32,
  },
  resultsTitle: {
    fontSize: 28,
    fontFamily: "Montserrat_600SemiBold",
    color: "#0F172A",
    marginTop: 16,
    marginBottom: 8,
  },
  resultsScore: {
    fontSize: 48,
    fontFamily: "Montserrat_600SemiBold",
    color: "#0EA5E9",
    marginBottom: 12,
  },
  resultsMessage: {
    fontSize: 16,
    fontFamily: "Roboto_400Regular",
    color: "#64748B",
    textAlign: "center",
    lineHeight: 24,
  },
  resultsDetails: {
    marginTop: 24,
  },
  resultItem: {
    marginBottom: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  resultQuestion: {
    fontSize: 16,
    fontFamily: "Montserrat_500Medium",
    color: "#0F172A",
    flex: 1,
    marginLeft: 8,
    lineHeight: 22,
  },
  resultAnswer: {
    fontSize: 14,
    fontFamily: "Roboto_400Regular",
    color: "#64748B",
    marginTop: 8,
  },
  resultCorrect: {
    fontSize: 14,
    fontFamily: "Roboto_500Medium",
    color: "#10B981",
    marginTop: 4,
  },
  resultExplanation: {
    fontSize: 14,
    fontFamily: "Roboto_400Regular",
    color: "#334155",
    marginTop: 8,
    lineHeight: 20,
  },
  resultsActions: {
    marginTop: 24,
  },
  recommendationContainer: {
    marginTop: 32,
  },
  recommendationCard: {
    backgroundColor: "#F0F9FF",
    borderRadius: 20,
    padding: 20,
    borderWidth: 2,
    borderColor: "#BAE6FD",
    marginTop: 12,
  },
  recommendationHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  recommendationTitle: {
    fontSize: 18,
    fontFamily: "Montserrat_600SemiBold",
    color: "#0F172A",
    marginLeft: 12,
    flex: 1,
  },
  recommendationText: {
    fontSize: 14,
    fontFamily: "Roboto_400Regular",
    color: "#334155",
    lineHeight: 20,
    marginBottom: 8,
  },
  confidenceText: {
    fontSize: 12,
    fontFamily: "Roboto_500Medium",
    color: "#0EA5E9",
    marginBottom: 16,
  },
  learningTypesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 8,
  },
  recommendedTypeCard: {
    flex: 1,
    minWidth: "30%",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#E2E8F0",
    padding: 16,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  recommendedTypeCardHighlighted: {
    borderColor: "#0EA5E9",
    backgroundColor: "#F0F9FF",
    borderWidth: 3,
  },
  recommendedTypeCardCurrent: {
    borderColor: "#10B981",
  },
  recommendedTypeLabel: {
    fontSize: 14,
    fontFamily: "Montserrat_600SemiBold",
    color: "#0F172A",
    marginTop: 8,
    textAlign: "center",
  },
  recommendedBadge: {
    backgroundColor: "#0EA5E9",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 8,
  },
  recommendedBadgeText: {
    fontSize: 10,
    fontFamily: "Montserrat_600SemiBold",
    color: "#FFFFFF",
  },
  currentBadgeText: {
    fontSize: 10,
    fontFamily: "Roboto_500Medium",
    color: "#10B981",
    marginTop: 4,
  },
  statsText: {
    fontSize: 11,
    fontFamily: "Roboto_400Regular",
    color: "#64748B",
    marginTop: 4,
    textAlign: "center",
  },
});

