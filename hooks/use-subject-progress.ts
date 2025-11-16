import { useState, useEffect } from 'react';
import { getTopicsFromDB } from '../lib/topics-service';
import { getQuizHistory } from '../lib/quiz-service';
import { useMLRecommendation } from './use-ml-recommendation';

/**
 * Hook to calculate and return progress percentage for a subject
 * Progress is based on completed topics (topics with quiz results) vs total topics
 */
export function useSubjectProgress(subjectId: string) {
  const [progress, setProgress] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const { recommendation } = useMLRecommendation(subjectId);

  useEffect(() => {
    const calculateProgress = async () => {
      if (!subjectId) {
        setProgress(0);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Get best learning type for topic lookup
        const bestType = recommendation?.bestPerformingMode || recommendation?.recommendedMode || 'text';

        // Load topics
        const topicsData = await getTopicsFromDB(subjectId, bestType as 'visual' | 'audio' | 'text');
        const totalTopics = topicsData?.topics?.length || 0;

        if (totalTopics === 0) {
          setProgress(0);
          setLoading(false);
          return;
        }

        // Load quiz results to determine completed topics
        try {
          const quizHistory = await getQuizHistory(subjectId);
          const completedTopicsSet = new Set<string>();
          
          if (quizHistory.results && quizHistory.results.length > 0) {
            quizHistory.results.forEach((quiz: any) => {
              if (quiz.topic) {
                completedTopicsSet.add(quiz.topic.toLowerCase());
              }
            });
          }

          // Calculate progress: (completed topics / total topics) * 100
          const completedCount = completedTopicsSet.size;
          const progressPercentage = Math.round((completedCount / totalTopics) * 100);
          setProgress(Math.min(100, Math.max(0, progressPercentage))); // Clamp between 0-100
        } catch (quizError) {
          console.warn("Failed to load quiz history for progress:", quizError);
          setProgress(0);
        }
      } catch (error) {
        console.error("Failed to calculate progress:", error);
        setProgress(0);
      } finally {
        setLoading(false);
      }
    };

    calculateProgress();
  }, [subjectId, recommendation]);

  return { progress, loading };
}

