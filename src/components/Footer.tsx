'use client';

import React, { useState, useEffect } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Initialize Supabase client with error handling
let supabase: SupabaseClient | undefined;
try {
  supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
} catch (error) {
  console.error('Failed to initialize Supabase client:', error);
}

export default function Footer() {
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Debug Supabase connection on component mount
  useEffect(() => {
    if (!supabase) {
      console.error('Supabase client not initialized');
      return;
    }
    
    // Test the connection
    supabase
      .from('feedback')
      .select('count')
      .then(({ data, error }: { data: any, error: any }) => {
        if (error) {
          console.error('Supabase connection test failed:', error);
        } else {
          console.log('Supabase connection successful');
        }
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!supabase) {
      console.error('Cannot submit feedback: Supabase client not initialized');
      setSubmitStatus('error');
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      console.log('Submitting feedback to API...');
      // First submit to our API route which will handle Canny
      const apiResponse = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message })
      });

      console.log('API response status:', apiResponse.status);
      let apiData;
      try {
        apiData = await apiResponse.json();
        console.log('API response data:', apiData);
      } catch (e) {
        console.error('Failed to parse API response:', e);
        throw new Error('Failed to parse server response');
      }
      
      if (!apiResponse.ok) {
        console.error('API error response:', {
          status: apiResponse.status,
          statusText: apiResponse.statusText,
          data: apiData
        });
        throw new Error(apiData.error || `Failed to submit feedback (${apiResponse.status})`);
      }

      // Then submit to Supabase
      console.log('Submitting feedback to Supabase...');
      const { data, error } = await supabase
        .from('feedback')
        .insert([{ 
          message,
          created_at: new Date().toISOString()
        }]);

      if (error) {
        console.error('Supabase error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }

      console.log('Feedback submitted successfully:', data);
      setMessage('');
      setSubmitStatus('success');
    } catch (error: any) {
      console.error('Error submitting feedback:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <footer className="w-full bg-white border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Share your thoughts</h3>
            <p className="text-sm text-gray-500">
              We're always looking to improve. Your feedback helps us make CiteMe better.
            </p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What's on your mind?"
                className="w-full px-4 py-3 text-sm text-black border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-colors"
                rows={3}
                required
              />
            </div>
            <div className="flex items-center justify-between">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Sending...' : 'Send feedback'}
              </button>
              {submitStatus === 'success' && (
                <span className="text-sm text-green-600">✓ Thank you for your feedback!</span>
              )}
              {submitStatus === 'error' && (
                <span className="text-sm text-red-600">Failed to send. Try again.</span>
              )}
            </div>
          </form>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-100">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="text-sm text-gray-500">
              © {new Date().getFullYear()} CiteMe. All rights reserved.
            </div>
            <div className="flex space-x-6">
              <a href="#" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                Privacy
              </a>
              <a href="#" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                Terms
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
} 