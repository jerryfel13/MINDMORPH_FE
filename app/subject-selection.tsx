import { generateCareerSubjects, getSubjects, getUserSubjects, saveUserSubjects, Subject } from "@/lib/subjects-service";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Keywords to identify language-related subjects
const LANGUAGE_KEYWORDS = [
  'language', 'japanese', 'korean', 'chinese', 'spanish', 'french', 'german', 
  'english', 'linguistics', 'communication', 'translation', 'localization',
  'japan', 'korea', 'china', 'spanish', 'french', 'german', 'italian', 'portuguese',
  'russian', 'arabic', 'hindi', 'mandarin', 'cantonese', 'dialect', 'grammar',
  'vocabulary', 'pronunciation', 'speaking', 'writing', 'reading', 'listening'
];

export default function SubjectSelectionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; from?: string }>();
  const isAddMode = params.mode === "add"; // If mode=add, we're adding to existing, not replacing
  const fromJourney = params.from === "journey"; // If from=journey, show back button
  
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [generalSubjects, setGeneralSubjects] = useState<Subject[]>([]);
  const [careerSubjects, setCareerSubjects] = useState<Subject[]>([]);
  const [languageSubjects, setLanguageSubjects] = useState<Subject[]>([]);
  const [otherGeneralSubjects, setOtherGeneralSubjects] = useState<Subject[]>([]);
  const [languageCareerSubjects, setLanguageCareerSubjects] = useState<Subject[]>([]);
  const [otherCareerSubjects, setOtherCareerSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interests, setInterests] = useState("");
  const [showInterestsInput, setShowInterestsInput] = useState(false);
  const [hasExistingSubjects, setHasExistingSubjects] = useState(false);
  const [existingSubjects, setExistingSubjects] = useState<Subject[]>([]);

  useEffect(() => {
    checkExistingSubjects();
    loadSubjects();
  }, [isAddMode]);

  const checkExistingSubjects = async () => {
    try {
      const userSubjectsData = await getUserSubjects();
      if (userSubjectsData.success && userSubjectsData.subjects && userSubjectsData.subjects.length > 0) {
        setHasExistingSubjects(true);
        setExistingSubjects(userSubjectsData.subjects);
        
        if (isAddMode) {
          // In add mode, don't pre-select existing subjects - let user select new ones
          setSelectedSubjects([]);
          console.log(`Add mode: User has ${userSubjectsData.subjects.length} existing subjects, allowing to add more`);
        } else {
          // In normal mode, pre-select existing subjects for editing
          setSelectedSubjects(userSubjectsData.subjects.map(s => s.id));
          console.log(`User already has ${userSubjectsData.subjects.length} selected subjects`);
        }
      }
    } catch (err: any) {
      console.log("No existing subjects found or error checking:", err.message);
      setHasExistingSubjects(false);
    }
  };

  const loadSubjects = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load general and career subjects
      const [generalData, careerData] = await Promise.all([
        getSubjects("general"),
        getSubjects("career"),
      ]);

      // Organize subjects: separate language-related subjects from other general subjects
      const allGeneral = generalData.subjects;
      
      const languageSubs: Subject[] = [];
      const otherGeneralSubs: Subject[] = [];
      
      allGeneral.forEach(subject => {
        const subjectText = `${subject.name} ${subject.description}`.toLowerCase();
        const isLanguage = LANGUAGE_KEYWORDS.some(keyword => subjectText.includes(keyword));
        
        if (isLanguage) {
          languageSubs.push(subject);
        } else {
          otherGeneralSubs.push(subject);
        }
      });
      
      setLanguageSubjects(languageSubs);
      setOtherGeneralSubjects(otherGeneralSubs);
      
      // Also organize career subjects: separate language-related career subjects
      const allCareer = careerData.subjects;
      const languageCareerSubs: Subject[] = [];
      const otherCareerSubs: Subject[] = [];
      
      allCareer.forEach(subject => {
        const subjectText = `${subject.name} ${subject.description}`.toLowerCase();
        const isLanguage = LANGUAGE_KEYWORDS.some(keyword => subjectText.includes(keyword));
        
        if (isLanguage) {
          languageCareerSubs.push(subject);
        } else {
          otherCareerSubs.push(subject);
        }
      });
      
      setLanguageCareerSubjects(languageCareerSubs);
      setOtherCareerSubjects(otherCareerSubs);
      setCareerSubjects(careerData.subjects); // Keep for backward compatibility
    } catch (err: any) {
      console.error("Error loading subjects:", err);
      setError(err.message || "Failed to load subjects");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateCareerSubjects = async () => {
    if (!interests.trim()) {
      setError("Please enter your interests to generate subjects");
      return;
    }

    try {
      setIsGenerating(true);
      setError(null);

      const interestsValue = interests.trim();
      console.log("🚀 [FRONTEND] Starting career subject generation");
      console.log("📝 [FRONTEND] User interests:", interestsValue);
      console.log("📝 [FRONTEND] API URL:", `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'}/api/subjects/generate`);
      
      const result = await generateCareerSubjects(interestsValue);
      
      console.log("✅ [FRONTEND] Generation result received:");
      console.log("   - Success:", result.success);
      console.log("   - Generated:", result.generated);
      console.log("   - Message:", result.message);
      console.log("   - Subjects count:", result.subjects?.length || 0);
      console.log("   - Subjects:", result.subjects?.map(s => s.name).join(", ") || "none");

      if (result.success && result.subjects && result.subjects.length > 0) {
        // Organize newly generated career subjects into language and non-language categories
        const newLanguageCareer: Subject[] = [];
        const newOtherCareer: Subject[] = [];
        
        result.subjects.forEach(subject => {
          const subjectText = `${subject.name} ${subject.description}`.toLowerCase();
          const isLanguage = LANGUAGE_KEYWORDS.some(keyword => subjectText.includes(keyword));
          
          if (isLanguage) {
            newLanguageCareer.push(subject);
          } else {
            newOtherCareer.push(subject);
          }
        });
        
        // Update both language and other career subjects
        setLanguageCareerSubjects(prev => [...prev, ...newLanguageCareer]);
        setOtherCareerSubjects(prev => [...prev, ...newOtherCareer]);
        setCareerSubjects(prev => [...prev, ...result.subjects]); // Keep for backward compatibility
        setShowInterestsInput(false);
        setInterests(""); // Clear input after successful generation
        console.log(`✅ [FRONTEND] Successfully processed ${result.subjects.length} subjects`);
        console.log(`   - Language-related: ${newLanguageCareer.length}, Other: ${newOtherCareer.length}`);
        console.log(`   - Subjects were ${result.generated ? 'GENERATED' : 'LOADED FROM DATABASE'}`);
      } else {
        console.error("❌ [FRONTEND] Invalid result structure:", result);
        throw new Error(result.message || "No subjects were generated");
      }
    } catch (err: any) {
      console.error("❌ [FRONTEND] Error generating subjects:");
      console.error("   - Error type:", err.constructor.name);
      console.error("   - Error message:", err.message);
      console.error("   - Error stack:", err.stack);
      if (err.response) {
        console.error("   - Response status:", err.response.status);
        console.error("   - Response data:", err.response.data);
      }
      const errorMessage = err.message || "Failed to generate subjects. Please try again.";
      setError(errorMessage);
      // Keep the input visible so user can try again
    } finally {
      setIsGenerating(false);
      console.log("🏁 [FRONTEND] Generation process completed");
    }
  };

  const toggleSubject = (subjectId: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(subjectId)
        ? prev.filter((id) => id !== subjectId)
        : [...prev, subjectId]
    );
  };

  const handleContinue = async () => {
    if (selectedSubjects.length === 0) {
      setError(isAddMode ? "Please select at least one subject to add" : "Please select at least one subject to continue");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      console.log(`${isAddMode ? "Adding" : "Saving"} selected subjects:`, selectedSubjects);
      const result = await saveUserSubjects(selectedSubjects, isAddMode);
      console.log(`Subjects ${isAddMode ? "added" : "saved"} successfully:`, result);
      
      // Navigate to journey page after successful save
      router.replace("/journey");
    } catch (err: any) {
      console.error("Error saving subjects:", err);
      setError(err.message || `Failed to ${isAddMode ? "add" : "save"} subjects. Please try again.`);
      setIsSaving(false);
    }
  };

  const renderSubjectCard = (subject: Subject, index: number, category: string) => {
    const isSelected = selectedSubjects.includes(subject.id);
    // In add mode, hide subjects that user already has
    if (isAddMode && existingSubjects.some(es => es.id === subject.id)) {
      return null;
    }
    // Use a unique key combining category and subject id to avoid duplicates
    const uniqueKey = `${category}-${subject.id}-${index}`;
    return (
      <TouchableOpacity
        key={uniqueKey}
        style={[styles.subjectCard, isSelected && styles.subjectCardSelected]}
        activeOpacity={0.8}
        onPress={() => toggleSubject(subject.id)}
      >
        <LinearGradient
          colors={subject.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.subjectCardGradient}
        >
          <View style={styles.subjectCardContent}>
            <View style={styles.subjectIconWrapper}>
              <MaterialCommunityIcons name={subject.icon as any} size={24} color="#FFFFFF" />
            </View>
            <Text style={styles.subjectName}>{subject.name}</Text>
            <Text style={styles.subjectDescription} numberOfLines={2}>
              {subject.description}
            </Text>
            {isSelected && (
              <View style={styles.selectedBadge}>
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              </View>
            )}
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <LinearGradient colors={["#F4F8FF", "#FFFFFF"]} style={styles.background}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1890FF" />
            <Text style={styles.loadingText}>Loading subjects...</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={["#F4F8FF", "#FFFFFF"]} style={styles.background}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          {fromJourney && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-back" size={24} color="#0F172A" />
            </TouchableOpacity>
          )}
          <View style={styles.header}>
            <Text style={styles.title}>
              {isAddMode 
                ? "Add More Subjects" 
                : hasExistingSubjects 
                  ? "Update Your Subjects" 
                  : "Choose Your Subjects"}
            </Text>
            <Text style={styles.subtitle}>
              {isAddMode
                ? `You currently have ${existingSubjects.length} subject${existingSubjects.length !== 1 ? 's' : ''}. Select additional subjects to add to your learning journey.`
                : hasExistingSubjects 
                  ? "You already have selected subjects. You can update your selection or continue with your current subjects."
                  : "Select the subjects you want to learn. You can choose from general subjects or career-focused topics."}
            </Text>
            {hasExistingSubjects && !isAddMode && (
              <TouchableOpacity
                style={styles.skipButton}
                onPress={() => router.replace("/journey")}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={styles.skipButtonText}>Continue with Current Subjects ({existingSubjects.length})</Text>
              </TouchableOpacity>
            )}
          </View>

          {error && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color="#B91C1C" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Language & Communication Subjects Section */}
          {languageSubjects.filter(s => !isAddMode || !existingSubjects.some(es => es.id === s.id)).length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="chatbubbles" size={20} color="#0F172A" />
                <Text style={styles.sectionTitle}>Language & Communication</Text>
              </View>
              <View style={styles.subjectsGrid}>
                {languageSubjects
                  .filter(s => !isAddMode || !existingSubjects.some(es => es.id === s.id))
                  .map((subject, index) => renderSubjectCard(subject, index, 'language'))
                  .filter(card => card !== null)}
              </View>
            </View>
          )}

          {/* General Academic Subjects Section */}
          {otherGeneralSubjects.filter(s => !isAddMode || !existingSubjects.some(es => es.id === s.id)).length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="school" size={20} color="#0F172A" />
                <Text style={styles.sectionTitle}>General Academic</Text>
              </View>
              <View style={styles.subjectsGrid}>
                {otherGeneralSubjects
                  .filter(s => !isAddMode || !existingSubjects.some(es => es.id === s.id))
                  .map((subject, index) => renderSubjectCard(subject, index, 'general'))
                  .filter(card => card !== null)}
              </View>
            </View>
          )}

          {/* Show message if all general subjects are already selected (only in add mode) */}
          {isAddMode && languageSubjects.filter(s => !existingSubjects.some(es => es.id === s.id)).length === 0 && 
           otherGeneralSubjects.filter(s => !existingSubjects.some(es => es.id === s.id)).length === 0 && (
            <View style={styles.section}>
              <View style={styles.emptySection}>
                <Text style={styles.emptySectionText}>All general subjects are already in your journey</Text>
              </View>
            </View>
          )}

          {/* Language Career Subjects Section (e.g., Japanese-for-tech) */}
          {languageCareerSubjects.filter(s => !isAddMode || !existingSubjects.some(es => es.id === s.id)).length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="language" size={20} color="#0F172A" />
                <Text style={styles.sectionTitle}>Language & Tech Careers</Text>
              </View>
              <View style={styles.subjectsGrid}>
                {languageCareerSubjects
                  .filter(s => !isAddMode || !existingSubjects.some(es => es.id === s.id))
                  .map((subject, index) => renderSubjectCard(subject, index, 'language-career'))
                  .filter(card => card !== null)}
              </View>
            </View>
          )}

          {/* Career Subjects Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="briefcase" size={20} color="#0F172A" />
              <Text style={styles.sectionTitle}>Career & Technical</Text>
            </View>
            
            {showInterestsInput ? (
              <View style={styles.interestsInputContainer}>
                <Text style={styles.interestsLabel}>
                  What are you interested in? (e.g., "web development, data science, cybersecurity")
                </Text>
                <TextInput
                  style={styles.interestsInput}
                  placeholder="Enter your interests..."
                  value={interests}
                  onChangeText={setInterests}
                  multiline
                />
                <View style={styles.interestsButtons}>
                  <TouchableOpacity
                    style={[styles.generateButton, (!interests.trim() || isGenerating) && styles.generateButtonDisabled]}
                    onPress={handleGenerateCareerSubjects}
                    disabled={!interests.trim() || isGenerating}
                    activeOpacity={0.8}
                  >
                    {isGenerating ? (
                      <>
                        <ActivityIndicator size="small" color="#FFFFFF" />
                        <Text style={styles.generateButtonText}>Generating...</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="sparkles" size={16} color="#FFFFFF" />
                        <Text style={styles.generateButtonText}>Generate Subjects</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => {
                      setShowInterestsInput(false);
                      setInterests("");
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                {otherCareerSubjects.filter(s => !isAddMode || !existingSubjects.some(es => es.id === s.id)).length === 0 && isAddMode ? (
                  <View style={styles.emptySection}>
                    <Text style={styles.emptySectionText}>All career subjects are already in your journey</Text>
                    <TouchableOpacity
                      style={styles.generateMoreButton}
                      onPress={() => setShowInterestsInput(true)}
                    >
                      <Ionicons name="sparkles" size={18} color="#1890FF" />
                      <Text style={styles.generateMoreText}>Generate More Career Subjects</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <View style={styles.subjectsGrid}>
                      {otherCareerSubjects
                        .filter(s => !isAddMode || !existingSubjects.some(es => es.id === s.id))
                        .map((subject, index) => renderSubjectCard(subject, index, 'career'))
                        .filter(card => card !== null)}
                    </View>
                    <TouchableOpacity
                      style={styles.generateMoreButton}
                      onPress={() => setShowInterestsInput(true)}
                    >
                      <Ionicons name="add-circle-outline" size={18} color="#1890FF" />
                      <Text style={styles.generateMoreText}>Generate More Career Subjects</Text>
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}
          </View>

          {/* Continue Button */}
          <TouchableOpacity
            style={[
              styles.continueButton,
              selectedSubjects.length === 0 && styles.continueButtonDisabled,
            ]}
            onPress={handleContinue}
            disabled={selectedSubjects.length === 0 || isSaving}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={selectedSubjects.length > 0 ? ["#1890FF", "#17C9B5"] : ["#94A3B8", "#94A3B8"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.continueButtonGradient}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.continueButtonText}>
                  {isAddMode 
                    ? `Add Subjects (${selectedSubjects.length})` 
                    : hasExistingSubjects 
                      ? "Update Selection" 
                      : "Continue"} ({selectedSubjects.length} selected)
                </Text>
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
  content: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 24,
  },
  backButton: {
    height: 44,
    width: 44,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#CBD5F5",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
    marginBottom: 8,
    alignSelf: "flex-start",
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
  header: {
    marginTop: 12,
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontFamily: "Montserrat_700Bold",
    color: "#0F172A",
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "Roboto_400Regular",
    color: "#64748B",
    lineHeight: 22,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderColor: "rgba(239, 68, 68, 0.35)",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Roboto_500Medium",
    color: "#B91C1C",
  },
  section: {
    gap: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: "Montserrat_600SemiBold",
    color: "#0F172A",
  },
  subjectsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  subjectCard: {
    width: "48%",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  subjectCardSelected: {
    borderWidth: 3,
    borderColor: "#1890FF",
  },
  subjectCardGradient: {
    padding: 16,
    minHeight: 140,
  },
  subjectCardContent: {
    gap: 8,
  },
  subjectIconWrapper: {
    alignSelf: "flex-start",
    padding: 8,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 8,
  },
  subjectName: {
    fontSize: 16,
    fontFamily: "Montserrat_600SemiBold",
    color: "#FFFFFF",
  },
  subjectDescription: {
    fontSize: 12,
    fontFamily: "Roboto_400Regular",
    color: "rgba(255, 255, 255, 0.9)",
    lineHeight: 16,
  },
  selectedBadge: {
    position: "absolute",
    top: 8,
    right: 8,
  },
  interestsInputContainer: {
    gap: 12,
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  interestsLabel: {
    fontSize: 14,
    fontFamily: "Roboto_500Medium",
    color: "#0F172A",
  },
  interestsInput: {
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    padding: 12,
    fontSize: 14,
    fontFamily: "Roboto_400Regular",
    color: "#0F172A",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    minHeight: 80,
    textAlignVertical: "top",
  },
  interestsButtons: {
    flexDirection: "row",
    gap: 12,
  },
  generateButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#1890FF",
    paddingVertical: 12,
    borderRadius: 12,
  },
  generateButtonDisabled: {
    opacity: 0.6,
    backgroundColor: "#94A3B8",
  },
  generateButtonText: {
    fontSize: 14,
    fontFamily: "Montserrat_600SemiBold",
    color: "#FFFFFF",
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
  },
  cancelButtonText: {
    fontSize: 14,
    fontFamily: "Roboto_500Medium",
    color: "#64748B",
  },
  generateMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderStyle: "dashed",
  },
  generateMoreText: {
    fontSize: 14,
    fontFamily: "Roboto_500Medium",
    color: "#1890FF",
  },
  continueButton: {
    borderRadius: 999,
    overflow: "hidden",
    shadowColor: "#1890FF",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonGradient: {
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  continueButtonText: {
    fontSize: 18,
    fontFamily: "Montserrat_600SemiBold",
    color: "#FFFFFF",
  },
  skipButton: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#86EFAC",
    alignSelf: "flex-start",
  },
  skipButtonText: {
    fontSize: 14,
    fontFamily: "Roboto_500Medium",
    color: "#10B981",
  },
  emptySection: {
    padding: 20,
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderStyle: "dashed",
  },
  emptySectionText: {
    fontSize: 13,
    fontFamily: "Roboto_400Regular",
    color: "#94A3B8",
    textAlign: "center",
  },
});

