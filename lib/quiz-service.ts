// Quiz Service - API calls for managing quiz attempts
import { getToken } from './storage';
import { getApiBaseUrl } from './api';

const API_URL = getApiBaseUrl();

/**
 * Get authentication headers
 */
async function getAuthHeaders() {
  const token = await getToken();
  if (!token) {
    throw new Error('No authentication token found. Please login.');
  }
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

/**
 * Quiz Response interface
 */
export interface QuizResponseData {
  question_id: number;
  question_text: string;
  question_type: 'multiple_choice' | 'true_false' | 'short_answer';
  user_answer: string | null;
  correct_answer: string;
  is_correct: boolean;
  explanation?: string | null;
}

/**
 * Save quiz attempt and responses to database
 */
export async function saveQuizAttempt(
  subject: string,
  topic: string,
  learningType: 'visual' | 'audio' | 'text',
  totalQuestions: number,
  correctAnswers: number,
  score: number,
  responses: QuizResponseData[],
  difficulty: 'easy' | 'medium' | 'hard' = 'medium',
  timeTaken?: number
): Promise<{
  success: boolean;
  quizResult: {
    id: string;
    subject: string;
    topic: string;
    learningType: string;
    score: number;
    totalQuestions: number;
    correctAnswers: number;
    completedAt: string;
  };
  responsesCount: number;
  // Backward compatibility: also include quizAttempt alias
  quizAttempt?: {
    id: string;
    subject: string;
    topic: string;
    learningType: string;
    score: number;
    totalQuestions: number;
    correctAnswers: number;
    completedAt: string;
  };
}> {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_URL}/api/quiz/save`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        subject,
        topic,
        learningType,
        difficulty,
        totalQuestions,
        correctAnswers,
        score,
        timeTaken,
        responses,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const errorMessage = error.details || error.message || error.error || `Failed to save quiz: ${response.status}`;
      console.error("Quiz save error details:", error);
      throw new Error(errorMessage);
    }

    const data = await response.json();
    // Add backward compatibility alias
    if (data.quizResult && !data.quizAttempt) {
      data.quizAttempt = data.quizResult;
    }
    return data;
  } catch (error: any) {
    console.error('Error saving quiz attempt:', error);
    throw error;
  }
}

/**
 * Get quiz history for a user
 */
export async function getQuizHistory(
  subject?: string,
  limit: number = 20
): Promise<{
  success: boolean;
  results: any[];
  attempts?: any[]; // Backward compatibility
  count: number;
}> {
  try {
    const headers = await getAuthHeaders();
    let url = `${API_URL}/api/quiz/history?limit=${limit}`;
    if (subject) {
      url += `&subject=${encodeURIComponent(subject)}`;
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || error.message || `Failed to get quiz history: ${response.status}`);
    }

    const data = await response.json();
    // Add backward compatibility alias
    if (data.results && !data.attempts) {
      data.attempts = data.results;
    }
    return data;
  } catch (error: any) {
    console.error('Error getting quiz history:', error);
    throw error;
  }
}

/**
 * Get detailed quiz result with responses
 */
export async function getQuizResult(resultId: string): Promise<{
  success: boolean;
  result: any;
  attempt?: any; // Backward compatibility
  responses: any[];
}> {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_URL}/api/quiz/result/${resultId}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || error.message || `Failed to get quiz result: ${response.status}`);
    }

    const data = await response.json();
    // Add backward compatibility alias
    if (data.result && !data.attempt) {
      data.attempt = data.result;
    }
    return data;
  } catch (error: any) {
    console.error('Error getting quiz result:', error);
    throw error;
  }
}

/**
 * Get latest quiz result for a specific subject and topic
 */
export async function getLatestQuizResult(
  subject: string,
  topic?: string
): Promise<{
  success: boolean;
  result: any | null;
  responses: any[];
}> {
  try {
    const headers = await getAuthHeaders();
    let url = `${API_URL}/api/quiz/latest?subject=${encodeURIComponent(subject)}`;
    if (topic) {
      url += `&topic=${encodeURIComponent(topic)}`;
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || error.message || `Failed to get latest quiz result: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('Error getting latest quiz result:', error);
    throw error;
  }
}

/**
 * Get detailed quiz attempt with responses (backward compatibility)
 * @deprecated Use getQuizResult instead
 */
export async function getQuizAttempt(attemptId: string): Promise<{
  success: boolean;
  attempt: any;
  responses: any[];
}> {
  return getQuizResult(attemptId);
}

