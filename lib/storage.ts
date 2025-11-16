// Storage utilities for token management
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = '@auth_token';
const USER_KEY = '@user_data';
const LEARNING_TYPES_PREFIX = '@learning_types:'; // per-subject learning type completion
const TOPICS_PREFIX = '@topics:'; // per-subject generated topics
const CONTENT_PREFIX = '@content:'; // per-subject-topic learning content cache

/**
 * Store authentication token
 */
export async function storeToken(token: string): Promise<void> {
  try {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } catch (error) {
    console.error('Error storing token:', error);
    throw error;
  }
}

/**
 * Get authentication token
 */
export async function getToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch (error) {
    console.error('Error getting token:', error);
    return null;
  }
}

/**
 * Remove authentication token
 */
export async function removeToken(): Promise<void> {
  try {
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(USER_KEY);
  } catch (error) {
    console.error('Error removing token:', error);
    throw error;
  }
}

/**
 * Store user data
 */
export async function storeUserData(userData: any): Promise<void> {
  try {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(userData));
  } catch (error) {
    console.error('Error storing user data:', error);
    throw error;
  }
}

/**
 * Get user data
 */
export async function getUserData(): Promise<any | null> {
  try {
    const data = await AsyncStorage.getItem(USER_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error getting user data:', error);
    return null;
  }
}

/**
 * Mark a learning type as completed for a given subject.
 * This is stored locally and can be used to gate access to subject topics
 * until all learning types (visual, audio, text) are completed.
 */
export async function markLearningTypeCompleted(
  subject: string,
  learningType: 'visual' | 'audio' | 'text'
): Promise<void> {
  try {
    const key = `${LEARNING_TYPES_PREFIX}${subject.toLowerCase().trim()}`;
    const raw = await AsyncStorage.getItem(key);
    const existing: string[] = raw ? JSON.parse(raw) : [];
    if (!existing.includes(learningType)) {
      const updated = [...existing, learningType];
      await AsyncStorage.setItem(key, JSON.stringify(updated));
    }
  } catch (error) {
    console.error('Error marking learning type completed:', error);
  }
}

/**
 * Get all completed learning types for a subject.
 */
export async function getCompletedLearningTypes(subject: string): Promise<string[]> {
  try {
    const key = `${LEARNING_TYPES_PREFIX}${subject.toLowerCase().trim()}`;
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error('Error getting completed learning types:', error);
    return [];
  }
}

/**
 * Check if all three learning types have been completed for a subject.
 */
export async function hasCompletedAllLearningTypes(subject: string): Promise<boolean> {
  const completed = await getCompletedLearningTypes(subject);
  const required = ['visual', 'audio', 'text'];
  return required.every((type) => completed.includes(type));
}

/**
 * Topic interface
 */
export interface Topic {
  id: string;
  title: string;
  description?: string;
  learningType: 'visual' | 'audio' | 'text';
  difficulty?: 'easy' | 'medium' | 'hard';
  createdAt: string;
}

/**
 * Store generated topics for a subject
 */
export async function storeTopics(
  subject: string,
  topics: Topic[],
  learningType: 'visual' | 'audio' | 'text'
): Promise<void> {
  try {
    const key = `${TOPICS_PREFIX}${subject.toLowerCase().trim()}`;
    const data = {
      topics,
      learningType,
      generatedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('Error storing topics:', error);
    throw error;
  }
}

/**
 * Get stored topics for a subject
 */
export async function getTopics(subject: string): Promise<{ topics: Topic[]; learningType: 'visual' | 'audio' | 'text'; generatedAt: string } | null> {
  try {
    const key = `${TOPICS_PREFIX}${subject.toLowerCase().trim()}`;
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error('Error getting topics:', error);
    return null;
  }
}

/**
 * Clear topics for a subject (for regeneration)
 */
export async function clearTopics(subject: string): Promise<void> {
  try {
    const key = `${TOPICS_PREFIX}${subject.toLowerCase().trim()}`;
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error('Error clearing topics:', error);
    throw error;
  }
}

/**
 * Store generated content for a topic
 * Key format: @content:{subject}:{topic}:{learningMode}
 */
export async function storeTopicContent(
  subject: string,
  topic: string,
  learningMode: 'visual' | 'audio' | 'text',
  content: any // GeneratedContent type
): Promise<void> {
  try {
    const key = `${CONTENT_PREFIX}${subject.toLowerCase().trim()}:${topic.toLowerCase().trim()}:${learningMode}`;
    const data = {
      content,
      subject: subject.toLowerCase().trim(),
      topic: topic.toLowerCase().trim(),
      learningMode,
      cachedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(key, JSON.stringify(data));
    console.log(`✅ Cached content for ${subject}/${topic} (${learningMode})`);
  } catch (error) {
    console.error('Error storing topic content:', error);
    throw error;
  }
}

/**
 * Get cached content for a topic
 */
export async function getTopicContent(
  subject: string,
  topic: string,
  learningMode: 'visual' | 'audio' | 'text'
): Promise<{ content: any; cachedAt: string } | null> {
  try {
    const key = `${CONTENT_PREFIX}${subject.toLowerCase().trim()}:${topic.toLowerCase().trim()}:${learningMode}`;
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      const data = JSON.parse(raw);
      console.log(`✅ Loaded cached content for ${subject}/${topic} (${learningMode})`);
      return data;
    }
    return null;
  } catch (error) {
    console.error('Error getting topic content:', error);
    return null;
  }
}

/**
 * Clear cached content for a topic (for regeneration)
 */
export async function clearTopicContent(
  subject: string,
  topic: string,
  learningMode?: 'visual' | 'audio' | 'text'
): Promise<void> {
  try {
    if (learningMode) {
      // Clear specific learning mode content
      const key = `${CONTENT_PREFIX}${subject.toLowerCase().trim()}:${topic.toLowerCase().trim()}:${learningMode}`;
      await AsyncStorage.removeItem(key);
    } else {
      // Clear all learning modes for this topic
      const modes: ('visual' | 'audio' | 'text')[] = ['visual', 'audio', 'text'];
      for (const mode of modes) {
        const key = `${CONTENT_PREFIX}${subject.toLowerCase().trim()}:${topic.toLowerCase().trim()}:${mode}`;
        await AsyncStorage.removeItem(key);
      }
    }
  } catch (error) {
    console.error('Error clearing topic content:', error);
    throw error;
  }
}

