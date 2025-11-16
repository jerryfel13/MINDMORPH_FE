// Hook for AI Content Generation
import { useState } from 'react';
import { generateContent, generateContentForMode, GeneratedContent } from '../lib/ai-service';
import { storeTopicContent, getTopicContent } from '../lib/storage';

interface UseAIContentResult {
  content: GeneratedContent | null;
  loading: boolean;
  error: string | null;
  generate: (subject: string, topic: string, difficulty?: 'easy' | 'medium' | 'hard') => Promise<void>;
  generateForMode: (subject: string, topic: string, learningMode: 'visual' | 'audio' | 'text', difficulty?: 'easy' | 'medium' | 'hard') => Promise<void>;
}

/**
 * Hook to generate AI content
 */
export function useAIContent(): UseAIContentResult {
  const [content, setContent] = useState<GeneratedContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async (
    subject: string,
    topic: string,
    difficulty: 'easy' | 'medium' | 'hard' = 'medium'
  ) => {
    try {
      setLoading(true);
      setError(null);
      
      // Note: generate() doesn't specify learning mode, so we can't cache it
      // This function is less commonly used - generateForMode is preferred
      const result = await generateContent(subject, topic, difficulty);
      setContent(result);
    } catch (err: any) {
      // Extract error message - ensure it's always a string
      let errorMessage = 'Failed to generate content';
      if (err?.message) {
        errorMessage = String(err.message);
      } else if (typeof err === 'string') {
        errorMessage = err;
      } else if (err?.error) {
        errorMessage = String(err.error);
      }
      
      setError(errorMessage);
      console.error('AI Content generation error:', {
        message: errorMessage,
        error: err,
        subject,
        topic,
        difficulty,
      });
    } finally {
      setLoading(false);
    }
  };

  const generateForMode = async (
    subject: string,
    topic: string,
    learningMode: 'visual' | 'audio' | 'text',
    difficulty: 'easy' | 'medium' | 'hard' = 'medium'
  ) => {
    try {
      setLoading(true);
      setError(null);
      
      // First, check if content is cached
      const cached = await getTopicContent(subject, topic, learningMode);
      if (cached && cached.content) {
        console.log('📦 Using cached content for', subject, topic, learningMode);
        setContent(cached.content);
        setLoading(false);
        return; // Exit early - use cached content
      }
      
      // If not cached, generate new content
      console.log('🔄 Generating new content for', subject, topic, learningMode);
      const result = await generateContentForMode(subject, topic, learningMode, difficulty);
      setContent(result);
      
      // Cache the generated content for future use
      try {
        await storeTopicContent(subject, topic, learningMode, result);
      } catch (cacheError) {
        console.warn('Failed to cache content (non-critical):', cacheError);
        // Don't throw - caching failure shouldn't break the flow
      }
    } catch (err: any) {
      // Extract error message - ensure it's always a string
      let errorMessage = 'Failed to generate content';
      if (err?.message) {
        errorMessage = String(err.message);
      } else if (typeof err === 'string') {
        errorMessage = err;
      } else if (err?.error) {
        errorMessage = String(err.error);
      }
      
      setError(errorMessage);
      console.error('AI Content generation error:', {
        message: errorMessage,
        error: err,
        subject,
        topic,
        learningMode,
        difficulty,
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    content,
    loading,
    error,
    generate,
    generateForMode,
  };
}

