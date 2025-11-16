// Learning Type Service - Check completion status from database
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
 * Check if user has completed all learning types for a subject
 * by checking activity_logs for quiz results with activity_type = 'visual', 'audio', 'text'
 */
export async function hasCompletedAllLearningTypesFromDB(subject: string): Promise<boolean> {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_URL}/api/learning-types/check?subject=${encodeURIComponent(subject)}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      if (response.status === 404) {
        return false;
      }
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || error.message || `Failed to check learning types: ${response.status}`);
    }

    const data = await response.json();
    console.log('Learning types check response:', data);
    return data.completed === true;
  } catch (error: any) {
    console.error('Error checking learning types from database:', error);
    return false;
  }
}

