'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

// Define types for diagnostic information
interface DiagnosticTest {
  name: string;
  success: boolean;
  error?: string;
  result?: string;
  status?: number;
  data?: unknown;
  headers?: Record<string, string>;
}

interface DiagnosticInfo {
  supabaseUrl: string | undefined;
  supabaseProjectId: string;
  edgeFunctionUrl: string;
  browser: string;
  timestamp: string;
  tests: DiagnosticTest[];
}

export default function EdgeFunctionTest() {
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [diagnosticInfo, setDiagnosticInfo] = useState<DiagnosticInfo | null>(null);

  // Test the connection using various approaches
  const testEdgeFunction = async () => {
    setIsLoading(true);
    setError('');
    setResult('');
    setDiagnosticInfo(null);

    // Gather diagnostic information
    const diagnostics: DiagnosticInfo = {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseProjectId: process.env.NEXT_PUBLIC_SUPABASE_URL ? process.env.NEXT_PUBLIC_SUPABASE_URL.split('.')[0].replace('https://', '') : 'unknown',
      edgeFunctionUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/extract-pdf-metadata` : 'unknown',
      browser: typeof window !== 'undefined' ? window.navigator.userAgent : 'SSR',
      timestamp: new Date().toISOString(),
      tests: []
    };

    try {
      console.log('Testing edge function with standard approach...');
      
      // Test 1: Standard approach
      try {
        const response = await supabase.functions.invoke('extract-pdf-metadata', {
          method: 'POST',
          body: JSON.stringify({ test: true, timestamp: new Date().toISOString() }),
          headers: {
            'Content-Type': 'application/json'
          }
        });

        console.log('Standard approach response:', response);
        diagnostics.tests.push({
          name: 'Standard invoke',
          success: !response.error,
          result: response.error ? `Error: ${response.error.message}` : 'Success',
          data: response.data
        });

        if (!response.error) {
          setResult(JSON.stringify(response.data, null, 2));
          setDiagnosticInfo(diagnostics);
          return; // Success! No need to try other approaches
        }
      } catch (err) {
        console.error('Standard approach error:', err);
        diagnostics.tests.push({
          name: 'Standard invoke',
          success: false,
          error: err instanceof Error ? err.message : String(err)
        });
      }

      // Test 2: Direct fetch approach (bypass Supabase client)
      console.log('Testing edge function with direct fetch...');
      try {
        // Make sure we have the URL
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
          throw new Error('Supabase URL is not configured');
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const functionName = 'extract-pdf-metadata';
        
        // Construct the URL manually
        const functionUrl = `${supabaseUrl}/functions/v1/${functionName}`;
        
        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({ test: true, timestamp: new Date().toISOString() })
        });

        console.log('Direct fetch response:', response);
        
        const data = await response.json();
        diagnostics.tests.push({
          name: 'Direct fetch',
          success: response.ok,
          status: response.status,
          result: response.ok ? 'Success' : `Error: ${response.statusText}`,
          data: data
        });

        if (response.ok) {
          setResult(JSON.stringify(data, null, 2));
          setDiagnosticInfo(diagnostics);
          return; // Success!
        }
      } catch (err) {
        console.error('Direct fetch error:', err);
        diagnostics.tests.push({
          name: 'Direct fetch',
          success: false,
          error: err instanceof Error ? err.message : String(err)
        });
      }

      // Test 3: CORS check
      console.log('Testing CORS configuration...');
      try {
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
          throw new Error('Supabase URL is not configured');
        }

        const corsTestUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/info/public/test-cors`;
        
        const corsResponse = await fetch(corsTestUrl, {
          method: 'OPTIONS',
          headers: {
            'Origin': window.location.origin,
            'Access-Control-Request-Method': 'GET'
          }
        });

        diagnostics.tests.push({
          name: 'CORS check',
          success: corsResponse.ok,
          status: corsResponse.status,
          headers: Object.fromEntries(corsResponse.headers.entries())
        });
      } catch (err) {
        console.error('CORS test error:', err);
        diagnostics.tests.push({
          name: 'CORS check',
          success: false,
          error: err instanceof Error ? err.message : String(err)
        });
      }

      // If we got here, all tests failed
      throw new Error('All connection tests failed. See console for details.');
    } catch (err) {
      console.error('All tests failed:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setDiagnosticInfo(diagnostics);
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg mt-6">
      <h2 className="text-lg font-semibold mb-4">Edge Function Test</h2>
      
      <button
        onClick={testEdgeFunction}
        disabled={isLoading}
        className="px-4 py-2 bg-[#7469B6] text-white rounded hover:bg-[#5A4F8C] disabled:opacity-50"
      >
        {isLoading ? 'Testing...' : 'Test Edge Function'}
      </button>
      
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
          <p className="font-medium">Error:</p>
          <pre className="mt-1 whitespace-pre-wrap">{error}</pre>
        </div>
      )}
      
      {result && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded text-sm">
          <p className="font-medium text-green-700">Success:</p>
          <pre className="mt-1 bg-white p-2 rounded overflow-auto max-h-40 text-gray-800">{result}</pre>
        </div>
      )}

      {diagnosticInfo && (
        <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded text-sm">
          <p className="font-medium">Diagnostic Information:</p>
          <pre className="mt-1 bg-white p-2 rounded overflow-auto max-h-60 text-gray-800">
            {JSON.stringify(diagnosticInfo, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
} 