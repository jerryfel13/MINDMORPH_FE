// Topics Service - API calls for managing topics
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
 * Get topics from database for a subject
 * Optionally pass learningType to check for shared topics from other users
 */
export async function getTopicsFromDB(
  subject: string,
  learningType?: 'visual' | 'audio' | 'text'
): Promise<{
  topics: Topic[];
  learningType: 'visual' | 'audio' | 'text' | null;
  generatedAt: string | null;
  isShared?: boolean;
} | null> {
  try {
    const headers = await getAuthHeaders();
    let url = `${API_URL}/api/topics?subject=${encodeURIComponent(subject)}`;
    
    // Add learningType query parameter if provided (for shared topics lookup)
    if (learningType) {
      url += `&learningType=${encodeURIComponent(learningType)}`;
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      if (response.status === 404) {
        // No topics found - return null
        return null;
      }
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || error.message || `Failed to get topics: ${response.status}`);
    }

    const data = await response.json();
    
    // If no topics in response, return null
    if (!data.topics || data.topics.length === 0) {
      return null;
    }
    
    return {
      topics: data.topics || [],
      learningType: data.learningType || null,
      generatedAt: data.generatedAt || null,
      isShared: data.isShared || false,
    };
  } catch (error: any) {
    console.error('Error getting topics from database:', error);
    throw error;
  }
}

/**
 * Save topics to database
 * Returns the response data which may include alreadyExists flag
 */
export async function saveTopicsToDB(
  subject: string,
  topics: Topic[],
  learningType: 'visual' | 'audio' | 'text'
): Promise<{ alreadyExists?: boolean; topics?: Topic[]; learningType?: string; message?: string } | void> {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_URL}/api/topics`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        subject,
        topics,
        learningType,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Failed to save topics: ${response.status}`);
    }

    const data = await response.json();
    console.log('Topics saved to database:', data.message || 'Success');
    
    // Return the response data in case it includes alreadyExists flag
    return data;
  } catch (error: any) {
    console.error('Error saving topics to database:', error);
    throw error;
  }
}

/**
 * Delete topics from database (for regeneration)
 */
export async function deleteTopicsFromDB(subject: string): Promise<void> {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_URL}/api/topics?subject=${encodeURIComponent(subject)}`,
      {
        method: 'DELETE',
        headers,
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Failed to delete topics: ${response.status}`);
    }
  } catch (error: any) {
    console.error('Error deleting topics from database:', error);
    throw error;
  }
}

