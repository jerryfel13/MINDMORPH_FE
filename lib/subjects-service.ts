// Subjects Service - API calls for managing subjects
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
 * Subject interface
 */
export interface Subject {
  id: string;
  name: string;
  category: 'general' | 'career';
  description: string;
  icon: string;
  colors: [string, string];
  selectedAt?: string;
  archivedAt?: string;
}

/**
 * Get all available subjects
 */
export async function getSubjects(category?: 'general' | 'career'): Promise<{
  success: boolean;
  subjects: Subject[];
  count: number;
}> {
  try {
    const headers = await getAuthHeaders();
    let url = `${API_URL}/api/subjects`;
    if (category) {
      url += `?category=${category}`;
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || error.message || `Failed to get subjects: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('Error getting subjects:', error);
    throw error;
  }
}

/**
 * Get user's selected subjects
 */
export async function getUserSubjects(): Promise<{
  success: boolean;
  subjects: Subject[];
  count: number;
}> {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_URL}/api/subjects/user`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || error.message || `Failed to get user subjects: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('Error getting user subjects:', error);
    throw error;
  }
}

/**
 * Get user's archived subjects
 */
export async function getArchivedSubjects(): Promise<{
  success: boolean;
  subjects: Subject[];
  count: number;
}> {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_URL}/api/subjects/user/archived`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || error.message || `Failed to get archived subjects: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('Error getting archived subjects:', error);
    throw error;
  }
}

/**
 * Archive a subject
 */
export async function archiveSubject(subjectId: string): Promise<{
  success: boolean;
  message: string;
  subject: Subject;
}> {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_URL}/api/subjects/user/${encodeURIComponent(subjectId)}/archive`, {
      method: 'POST',
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || error.message || `Failed to archive subject: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('Error archiving subject:', error);
    throw error;
  }
}

/**
 * Unarchive a subject
 */
export async function unarchiveSubject(subjectId: string): Promise<{
  success: boolean;
  message: string;
  subject: Subject;
}> {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_URL}/api/subjects/user/${encodeURIComponent(subjectId)}/unarchive`, {
      method: 'POST',
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || error.message || `Failed to unarchive subject: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('Error unarchiving subject:', error);
    throw error;
  }
}

/**
 * Save selected subjects for user
 * @param subjectIds - Array of subject IDs to save
 * @param addMode - If true, adds subjects to existing ones. If false, replaces all subjects.
 */
export async function saveUserSubjects(subjectIds: string[], addMode: boolean = false): Promise<{
  success: boolean;
  message: string;
  subjects: Subject[];
}> {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_URL}/api/subjects/user`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ subjectIds, addMode }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || error.message || `Failed to save subjects: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('Error saving user subjects:', error);
    throw error;
  }
}

/**
 * Generate career subjects using AI
 */
export async function generateCareerSubjects(interests?: string): Promise<{
  success: boolean;
  subjects: Subject[];
  generated: boolean;
  message: string;
}> {
  try {
    console.log("📡 [SERVICE] Preparing to call generate subjects API");
    console.log("   - API URL:", `${API_URL}/api/subjects/generate`);
    console.log("   - Interests:", interests || 'technology and programming');
    
    const headers = await getAuthHeaders();
    console.log("   - Headers:", { ...headers, Authorization: headers.Authorization ? 'Bearer ***' : 'missing' });
    
    const requestBody = {
      interests: interests || 'technology and programming',
      category: 'career',
    };
    console.log("   - Request body:", requestBody);
    
    const response = await fetch(`${API_URL}/api/subjects/generate`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    console.log("📥 [SERVICE] Response received:");
    console.log("   - Status:", response.status);
    console.log("   - Status text:", response.statusText);
    console.log("   - OK:", response.ok);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
        console.error("❌ [SERVICE] Error response data:", errorData);
      } catch (parseError) {
        const textError = await response.text().catch(() => '');
        console.error("❌ [SERVICE] Error response text:", textError);
        errorData = { error: textError || `HTTP ${response.status}` };
      }
      throw new Error(errorData.error || errorData.message || `Failed to generate subjects: ${response.status}`);
    }

    const data = await response.json();
    console.log("✅ [SERVICE] Success response:");
    console.log("   - Success:", data.success);
    console.log("   - Generated:", data.generated);
    console.log("   - Message:", data.message);
    console.log("   - Subjects count:", data.subjects?.length || 0);
    
    return data;
  } catch (error: any) {
    console.error('❌ [SERVICE] Error in generateCareerSubjects:');
    console.error("   - Error type:", error?.constructor?.name || typeof error);
    console.error("   - Error message:", error?.message);
    console.error("   - Error stack:", error?.stack);
    throw error;
  }
}

