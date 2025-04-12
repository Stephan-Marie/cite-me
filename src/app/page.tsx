'use client';

import { useState, useEffect } from 'react';
import FileUploadZone from '../components/FileUploadZone';
import { supabase } from '../lib/supabase';
import EdgeFunctionTest from '../components/EdgeFunctionTest';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle, AlignmentType, Table, TableRow, TableCell, WidthType, Header, Footer } from 'docx';
import { saveAs } from 'file-saver';
import RichTextEditor from '../components/RichTextEditor';

// Add these interfaces at the top of the file after imports
interface EdgeFunctionResult {
  fileName: string;
  citation: string;
  analysis?: string;
  footnotes?: string | string[];
}

interface EdgeFunctionError {
  fileName: string;
  error: string;
}

interface EdgeFunctionResponse {
  results?: EdgeFunctionResult[];
  errors?: EdgeFunctionError[];
}

// Add this interface at the top of the file alongside the other interfaces
interface EdgeFunctionRequest {
  pdfUrls: { url: string; fileName: string }[];
  citationStyle?: string;
  masterpiece?: { url: string; fileName: string } | { text: string; fileName: string };
}

// Helper function to process bibliography entries based on citation style
const processBibliographyText = (text: string, style: string): string => {
  if (!text) return '';
  
  // Clean up the text and ensure consistent line breaks
  let cleanedText = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  
  // Process based on citation style
  switch (style) {
    case 'APA':
      // Ensure double spacing between entries
      return cleanedText.split('\n\n')
        .filter(entry => entry.trim())
        .join('\n\n');
      
    case 'MLA':
    case 'Chicago':
      // Similar formatting to APA
      return cleanedText.split('\n\n')
        .filter(entry => entry.trim())
        .join('\n\n');
      
    case 'OSCOLA':
      // OSCOLA often uses footnotes with superscript numbers
      // Clean up any numbered items and ensure proper spacing
      return cleanedText.replace(/^\s*\d+\.\s+/gm, '').trim();
      
    case 'IEEE':
      // IEEE uses numbered references in square brackets
      // Preserve the numbers but ensure proper formatting
      return cleanedText.replace(/^\s*\[\d+\]\s*/gm, match => `${match.trim()} `)
        .split('\n\n')
        .filter(entry => entry.trim())
        .join('\n\n');
      
    default:
      return cleanedText;
  }
};

export default function Home() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [masterFile, setMasterFile] = useState<File[]>([]);
  const [masterText, setMasterText] = useState<string>('');
  const [inputMode, setInputMode] = useState<'file' | 'text'>('file');
  const [citations, setCitations] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [citationStyle, setCitationStyle] = useState<string>('OSCOLA');
  const [diagnostics, setDiagnostics] = useState<{supabase: boolean, storage: boolean, functions: boolean}>({
    supabase: false,
    storage: false,
    functions: false
  });
  const [results, setResults] = useState<EdgeFunctionResult[]>([]);
  const [editableCitations, setEditableCitations] = useState<Record<string, string>>({});

  // Check Supabase connection on load
  useEffect(() => {
    checkSupabaseConnection();
  }, []);

  const checkSupabaseConnection = async () => {
    setError('');
    const results = {
      supabase: false,
      storage: false,
      functions: false
    };
    
    try {
      // Test basic Supabase connection
      const { data, error } = await supabase.from('dummy').select('*').limit(1).maybeSingle();
      // We expect an error about the table not existing, but not a connection error
      results.supabase = !error || error.code !== 'PGRST301';
      
      // Test storage
      try {
        const { data: storageData } = await supabase.storage.getBucket('pdfs');
        results.storage = !!storageData;
      } catch (e) {
        // Try listing buckets as fallback
        const { data: buckets } = await supabase.storage.listBuckets();
        results.storage = Array.isArray(buckets);
      }
      
      // Test functions
      try {
        // Try to ping a specific function instead of listing
        const { data } = await supabase.functions.invoke('extract-pdf-metadata', {
          body: { test: true }
        });
        results.functions = true;
      } catch (funcError) {
        console.log('Function test error:', funcError);
        results.functions = false;
      }
    } catch (e) {
      console.error('Connection test error:', e);
    }
    
    setDiagnostics(results);
    
    if (!results.supabase) {
      setError('Unable to connect to Supabase. Check your API credentials.');
    } else if (!results.storage) {
      setError('Connected to Supabase, but storage access failed. Check bucket permissions.');
    } else if (!results.functions) {
      setError('Connected to Supabase, but edge functions access failed. Check function permissions.');
    }
  };

  // File selection handlers
  const handleFileSelect = (files: File[]) => {
    setSelectedFiles(prevFiles => [...prevFiles, ...files]);
    setCitations({});
    setError('');
  };

  const handleMasterFileSelect = (files: File[]) => {
    if (inputMode === 'text' && masterText.trim() !== '') {
      // Ask user to confirm switching from text to file mode
      if (!confirm('Switching to file mode will clear your pasted text. Continue?')) {
        return;
      }
    }
    
    setMasterText('');
    setInputMode('file');
    setMasterFile(files);
    setCitations({});
    setError('');
  };

  const handleMasterTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    
    if (inputMode === 'file' && masterFile.length > 0) {
      // Ask user to confirm switching from file to text mode
      if (!confirm('Switching to text mode will remove your uploaded masterpiece file. Continue?')) {
        return;
      }
    }
    
    setMasterFile([]);
    setInputMode('text');
    setMasterText(newText);
    setCitations({});
    setError('');
  };

  const toggleInputMode = () => {
    if (inputMode === 'file' && masterFile.length > 0) {
      if (!confirm('Switching to text mode will remove your uploaded masterpiece file. Continue?')) {
        return;
      }
      setMasterFile([]);
    } else if (inputMode === 'text' && masterText.trim() !== '') {
      if (!confirm('Switching to file mode will clear your pasted text. Continue?')) {
        return;
      }
      setMasterText('');
    }
    
    setInputMode(prevMode => prevMode === 'file' ? 'text' : 'file');
  };

  const handleFileRemove = (fileToRemove: File) => {
    setSelectedFiles(prevFiles => prevFiles.filter(file => file !== fileToRemove));
    setCitations(prevCitations => {
      const newCitations = { ...prevCitations };
      delete newCitations[fileToRemove.name];
      return newCitations;
    });
  };

  const handleMasterFileRemove = (fileToRemove: File) => {
    setMasterFile([]);
    setCitations(prevCitations => {
      const newCitations = { ...prevCitations };
      delete newCitations[fileToRemove.name];
      return newCitations;
    });
  };

  // Process a single file
  const processFile = async (file: File): Promise<{ url: string; fileName: string }> => {
    const fileExt = file.name.split('.').pop() || 'pdf';
    const uniqueId = Math.random().toString(36).substring(2);
    const fileName = `upload_${uniqueId}.${fileExt}`;
    
    try {
      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('pdfs')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const urlResult = supabase.storage.from('pdfs').getPublicUrl(fileName);
      const publicUrl = urlResult.data.publicUrl;

      return { url: publicUrl, fileName: file.name };

    } catch (error) {
      throw error;
    }
  };

  // Handle citation generation for all files
  const handleGenerateCitations = async () => {
    if (selectedFiles.length === 0) {
      setError('Please select at least one reference PDF file');
      return;
    }

    setIsLoading(true);
    setError('');
    const newCitations: Record<string, string> = {};
    const errors: string[] = [];
    const uploadedFiles: { url: string; fileName: string }[] = [];
    let masterPieceData = null;

    try {
      // First, handle masterpiece data based on input mode
      if (inputMode === 'file' && masterFile.length > 0) {
        try {
          const fileData = await processFile(masterFile[0]);
          masterPieceData = fileData;
          console.log('Masterpiece file processed:', masterPieceData);
        } catch (err) {
          console.error('Masterpiece file upload error:', err);
          errors.push(`Error uploading masterpiece ${masterFile[0].name}: ${err instanceof Error ? err.message : String(err)}`);
        }
      } else if (inputMode === 'text' && masterText.trim() !== '') {
        // Use text input as masterpiece
        masterPieceData = {
          text: masterText,
          fileName: 'Pasted Text'
        };
        console.log('Using pasted text as masterpiece');
      }
      
      // Then upload reference files
      for (const file of selectedFiles) {
        try {
          const fileData = await processFile(file);
          uploadedFiles.push(fileData);
        } catch (err) {
          console.error('File upload error:', err);
          errors.push(`Error uploading ${file.name}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      if (uploadedFiles.length > 0) {
        // Debug log the payload being sent
        const payload: EdgeFunctionRequest = {
          pdfUrls: uploadedFiles,
          citationStyle: citationStyle
        };
        
        // Add masterpiece if present
        if (masterPieceData) {
          payload.masterpiece = masterPieceData;
        }
        
        console.log('Sending to Edge Function:', JSON.stringify(payload));
        
        try {
          console.log('Starting Edge Function call...');
          
          // Call Edge Function with all file URLs
          const response = await supabase.functions.invoke('extract-pdf-metadata', {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: {
              'Content-Type': 'application/json'
            }
          });

          console.log('Edge Function response:', response);

          if (response.error) {
            console.error('Edge Function error:', response.error);
            throw new Error(`Edge Function error: ${response.error.message || 'Unknown error'}`);
          }
          
          // Process results with HTML formatting
          if (response.data && response.data.results && Array.isArray(response.data.results)) {
            setResults(response.data.results);
            
            response.data.results.forEach((result: EdgeFunctionResult) => {
              if (result && result.fileName && result.citation) {
                // Format citation with HTML for rich text
                const richTextCitation = prepareRichTextCitation(result.citation);
                newCitations[result.fileName] = richTextCitation;
              } else {
                console.warn('Invalid result format:', result);
              }
            });
          } else {
            console.warn('No results in response:', response.data);
          }

          // Add any errors from the edge function
          if (response.data && response.data.errors && Array.isArray(response.data.errors)) {
            response.data.errors.forEach((error: EdgeFunctionError) => {
              if (error && error.fileName && error.error) {
                errors.push(`Error processing ${error.fileName}: ${error.error}`);
              } else {
                console.warn('Invalid error format:', error);
              }
            });
          }
        } catch (funcError: any) {
          console.error('Edge Function invocation error details:', {
            message: funcError.message,
            stack: funcError.stack,
            name: funcError.name,
            cause: funcError.cause,
          });
          
          // Try alternative approach using direct fetch to the Edge Function
          try {
            console.log('Attempting direct fetch to Edge Function...');
            
            if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
              throw new Error('Supabase URL not configured');
            }
            
            const functionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/extract-pdf-metadata`;
            
            const fetchResponse = await fetch(functionUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
              },
              body: JSON.stringify(payload)
            });
            
            if (!fetchResponse.ok) {
              const errorText = await fetchResponse.text();
              throw new Error(`HTTP error ${fetchResponse.status}: ${errorText}`);
            }
            
            const data = await fetchResponse.json();
            console.log('Direct fetch response:', data);
            
            // Process results using same logic as above
            if (data && data.results && Array.isArray(data.results)) {
              setResults(data.results);
              
              data.results.forEach((result: EdgeFunctionResult) => {
                if (result && result.fileName && result.citation) {
                  // Format citation with HTML for rich text
                  const richTextCitation = prepareRichTextCitation(result.citation);
                  newCitations[result.fileName] = richTextCitation;
                }
              });
            }
            
            if (data && data.errors && Array.isArray(data.errors)) {
              data.errors.forEach((error: EdgeFunctionError) => {
                if (error && error.fileName && error.error) {
                  errors.push(`Error processing ${error.fileName}: ${error.error}`);
                }
              });
            }
          } catch (directFetchError) {
            console.error('Direct fetch error:', directFetchError);
            // Re-throw the original error
            throw funcError;
          }
        }
      }

      // Clean up uploaded files
      try {
        await Promise.all(
          uploadedFiles.map(({ url }) => {
            // Extract the filename from the Supabase URL
            const urlParts = url.split('/');
            const fileName = urlParts[urlParts.length - 1];
            
            if (!fileName) {
              console.warn('Could not extract filename from URL:', url);
              return Promise.resolve();
            }
            
            return supabase.storage.from('pdfs').remove([fileName]);
          })
        );
      } catch (cleanupError) {
        console.error('Error cleaning up files:', cleanupError);
        // Don't fail the whole operation if cleanup fails
      }

      if (errors.length > 0) {
        setError(errors.join('\n'));
      }

      setCitations(newCitations);
      setEditableCitations(newCitations);
    } catch (err) {
      console.error('Citation generation error:', err);
      setError('Failed to process files: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  // New function to handle saving edited citations
  const handleSaveCitation = (fileName: string, newContent: string) => {
    setEditableCitations(prev => ({
      ...prev,
      [fileName]: newContent
    }));
  };

  // Function to prepare citation text with HTML for rich text display
  const prepareRichTextCitation = (citation: string) => {
    // Add HTML formatting to citations if they're plain text
    if (!citation.includes('<') || !citation.includes('>')) {
      // Basic formatting for different citation styles
      let formattedCitation = citation;
      
      // Format headers and add proper spacing
      formattedCitation = formattedCitation.replace(
        /^(.*?)(?:\n|$)/gm, 
        (match, p1) => {
          // Check if this is likely a header
          if (p1.length < 80 && !p1.includes('.') && p1.trim()) {
            return `<h3 style="font-weight: bold; margin-top: 1em; margin-bottom: 0.5em;">${p1}</h3>`;
          }
          return `<p style="margin-bottom: 1em;">${p1}</p>`;
        }
      );
      
      // Extract potential bibliography references
      const bibliographyEntries: Record<string, string> = {};
      
      // Extract entries based on citation style
      if (citationStyle === 'OSCOLA') {
        // Extract footnote references like [1], [2], etc.
        const footnoteRegex = /(?:^\d+\.\s*|\[\d+\]\s*)([^]*?)(?=^\d+\.|$)/gm;
        let match;
        
        while ((match = footnoteRegex.exec(citation)) !== null) {
          const refNumber = match[0].trim().replace(/[\[\]\.\s]/g, '');
          const refContent = match[1].trim();
          if (refNumber && refContent) {
            bibliographyEntries[refNumber] = refContent;
          }
        }
      } else if (citationStyle === 'APA' || citationStyle === 'MLA') {
        // Extract author-year entries
        const bibRegex = /^([A-Za-z-]+(?:,\s+[A-Za-z]\.|(?:\s+&\s+[A-Za-z-]+))?)[^(]*\((\d{4})\)/gm;
        let match;
        
        while ((match = bibRegex.exec(citation)) !== null) {
          const author = match[1].trim();
          const year = match[2];
          if (author && year) {
            const key = `${author.split(',')[0]}-${year}`;
            bibliographyEntries[key] = match[0];
          }
        }
      } else if (citationStyle === 'IEEE') {
        // Extract numbered references [1], [2], etc.
        const ieeeBibRegex = /^\[(\d+)\]\s+([^]*?)(?=\[\d+\]|$)/gm;
        let match;
        
        while ((match = ieeeBibRegex.exec(citation)) !== null) {
          const refNumber = match[1];
          const refContent = match[2].trim();
          if (refNumber && refContent) {
            bibliographyEntries[refNumber] = refContent;
          }
        }
      }
      
      // Format in-text citations based on citation style
      if (citationStyle === 'OSCOLA') {
        // Style footnote references in text
        formattedCitation = formattedCitation.replace(
          /\[(\d+)\]/g, 
          (match, refNumber) => {
            if (bibliographyEntries[refNumber]) {
              return `<span class="citation-ref" title="${bibliographyEntries[refNumber]}"><strong style="color: #1e3a8a;">[${refNumber}]</strong></span>`;
            }
            return `<strong style="color: #1e3a8a;">[${refNumber}]</strong>`;
          }
        );
        
        // Identify and italicize case names (typically the first part of a citation)
        formattedCitation = formattedCitation.replace(
          /^([^,;]+)(,|;|\sv|$)/gm, 
          '<em style="color: #4361ee;">$1</em>$2'
        );
        
        // Highlight statute names in italics (Acts, etc.)
        formattedCitation = formattedCitation.replace(
          /(Act\s+\d{4}|Constitution|Treaty|Directive|Regulation)/g,
          '<em style="color: #4361ee;">$1</em>'
        );
      } else if (citationStyle === 'APA') {
        // Style in-text citations
        formattedCitation = formattedCitation.replace(
          /\(([A-Za-z-]+(?:(?:\s+&\s+|,\s+)[A-Za-z-]+)?)(?:,\s+|\s+)(\d{4})\)/g,
          (match, author, year) => {
            const key = `${author.split(',')[0]}-${year}`;
            if (bibliographyEntries[key]) {
              return `<span class="citation-ref" title="${bibliographyEntries[key]}">(<strong style="color: #1e3a8a;">${author}, ${year}</strong>)</span>`;
            }
            return `(<strong style="color: #1e3a8a;">${author}, ${year}</strong>)`;
          }
        );
        
        // Highlight author surnames in bibliography
        formattedCitation = formattedCitation.replace(
          /^([A-Za-z-]+,\s+[A-Z]\.\s*(?:&\s+[A-Za-z-]+,\s+[A-Z]\.\s*)*)(\(\d{4}\))/g,
          '<strong style="color: #1e3a8a;">$1</strong>$2'
        );
        
        // Highlight titles in italics
        formattedCitation = formattedCitation.replace(
          /(?:\.\s+|\:\s+)([^\.]+)(?=\.|$)/g,
          '. <em style="color: #4361ee;">$1</em>'
        );
      } else if (citationStyle === 'MLA') {
        // Style in-text citations
        formattedCitation = formattedCitation.replace(
          /\(([A-Za-z-]+)\s+(\d+(?:-\d+)?)\)/g,
          (match, author, page) => {
            // Try to find matching entry
            const possibleKeys = Object.keys(bibliographyEntries).filter(k => k.startsWith(`${author}-`));
            if (possibleKeys.length > 0) {
              return `<span class="citation-ref" title="${bibliographyEntries[possibleKeys[0]]}">(<strong style="color: #1e3a8a;">${author} ${page}</strong>)</span>`;
            }
            return `(<strong style="color: #1e3a8a;">${author} ${page}</strong>)`;
          }
        );
        
        // Highlight author names in bibliography
        formattedCitation = formattedCitation.replace(
          /^([A-Za-z-]+,\s+[A-Za-z\s\.]+)(?=\.)/g,
          '<strong style="color: #1e3a8a;">$1</strong>'
        );
        
        // Highlight titles in italics
        formattedCitation = formattedCitation.replace(
          /"([^"]+)"/g,
          '"<em style="color: #4361ee;">$1</em>"'
        );
        
        // Highlight page numbers
        formattedCitation = formattedCitation.replace(
          /(\s+\d+-\d+|\s+\d+)\.$/gm,
          '<strong style="color: #1e3a8a;">$1</strong>.'
        );
      } else if (citationStyle === 'IEEE') {
        // Style in-text citation references
        formattedCitation = formattedCitation.replace(
          /\[(\d+)\]/g,
          (match, refNumber) => {
            if (bibliographyEntries[refNumber]) {
              return `<span class="citation-ref" title="${bibliographyEntries[refNumber]}">[<strong style="color: #1e3a8a;">${refNumber}</strong>]</span>`;
            }
            return `[<strong style="color: #1e3a8a;">${refNumber}</strong>]`;
          }
        );
        
        // Highlight titles in quotes
        formattedCitation = formattedCitation.replace(
          /"([^"]+)"/g,
          '"<em style="color: #4361ee;">$1</em>"'
        );
      }
      
      // Add highlight for newly added citations
      if (citation.includes("as shown by") || citation.includes("suggests that") || citation.includes("according to")) {
        // Use separate regex to find newly cited content
        const citationPatterns = [
          // Common citation phrases that indicate new citations
          /([^.!?]*(?:as shown by|according to|suggests that|indicates that|argues that|notes that|demonstrates|reveals|contends)[^.!?]*[.!?])/gi,
          // Sentences with multiple citations (likely new)
          /([^.!?]*(?:[\(\[][A-Za-z0-9]+[,\s]*\d{4}[\)\]].*[\(\[][A-Za-z0-9]+[,\s]*\d{4}[\)\]])[^.!?]*[.!?])/g,
          // Recently added citations typically have distinct patterns
          /([^.!?]*(?:see also|cf\.|compare|but see)[^.!?]*[.!?])/gi
        ];
        
        // For each pattern, highlight sentences containing new citations
        // but preserve the original text formatting
        citationPatterns.forEach(pattern => {
          formattedCitation = formattedCitation.replace(pattern, (match) => {
            // Avoid double-wrapping already highlighted content
            if (!match.includes('mce-annotation')) {
              return `<span class="mce-annotation" data-mce-annotation-uid="citation-highlight" data-mce-annotation="citation" style="background-color: #fff8c5;">${match}</span>`;
            }
            return match;
          });
        });
      }
      
      // Add bibliography/footnotes section if there are entries and it's not already included
      if (Object.keys(bibliographyEntries).length > 0 && !citation.includes("<h4>References</h4>") && !citation.includes("<h4>Bibliography</h4>") && !citation.includes("<h4>Footnotes</h4>")) {
        let bibTitle = "References";
        if (citationStyle === 'OSCOLA') bibTitle = "Footnotes";
        else if (citationStyle === 'MLA') bibTitle = "Works Cited";
        
        formattedCitation += `<h4 style="font-weight: bold; margin-top: 2em; margin-bottom: 0.5em;">${bibTitle}</h4>`;
        
        // Add format-specific bibliography
        if (citationStyle === 'OSCOLA') {
          // Numbered footnotes
          Object.keys(bibliographyEntries).sort((a, b) => parseInt(a) - parseInt(b)).forEach(num => {
            formattedCitation += `<p style="margin-bottom: 0.5em;"><strong style="color: #1e3a8a;">${num}.</strong> ${bibliographyEntries[num]}</p>`;
          });
        } else if (citationStyle === 'APA' || citationStyle === 'MLA') {
          // Alphabetical entries with hanging indent
          formattedCitation += `<div style="margin-top: 1em;">`;
          Object.values(bibliographyEntries).forEach(entry => {
            formattedCitation += `<p style="margin-bottom: 0.5em; padding-left: 2em; text-indent: -2em;">${entry}</p>`;
          });
          formattedCitation += `</div>`;
        } else if (citationStyle === 'IEEE') {
          // Numbered references
          Object.keys(bibliographyEntries).sort((a, b) => parseInt(a) - parseInt(b)).forEach(num => {
            formattedCitation += `<p style="margin-bottom: 0.5em;"><strong style="color: #1e3a8a;">[${num}]</strong> ${bibliographyEntries[num]}</p>`;
          });
        }
      }
      
      return formattedCitation;
    }
    
    // If content already has HTML formatting, apply just the highlighting for new citations
    if (!citation.includes('mce-annotation')) {
      // Highlight newly added citations without replacing existing HTML
      const citationPatterns = [
        /([^.!?]*(?:as shown by|according to|suggests that|indicates that|argues that|notes that|demonstrates|reveals|contends)[^.!?]*[.!?])/gi,
        /([^.!?]*(?:see also|cf\.|compare|but see)[^.!?]*[.!?])/gi
      ];
      
      let highlightedCitation = citation;
      
      // Apply highlighting to newly cited content
      citationPatterns.forEach(pattern => {
        highlightedCitation = highlightedCitation.replace(pattern, (match) => {
          // Only wrap the match if it's not already wrapped with annotation tags
          if (!match.includes('mce-annotation')) {
            return `<span class="mce-annotation" data-mce-annotation-uid="citation-highlight" data-mce-annotation="citation" style="background-color: #fff8c5;">${match}</span>`;
          }
          return match;
        });
      });
      
      return highlightedCitation;
    }
    
    return citation; // Already contains HTML with potential highlights
  };

  // New function to generate PDF from edited rich content
  const handleDownloadPDF = (filename: string, citation: string, footnotes?: string | string[]) => {
    // Use the potentially edited citation from editableCitations if available
    const citationContent = editableCitations[filename] || citation;

    try {
      // Create a new PDF document (A4 format)
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      // Define colors and styles
      const primaryColor: [number, number, number] = [0, 102, 204]; // RGB for blue
      const secondaryColor: [number, number, number] = [64, 64, 64]; // Dark gray for text
      
      // Add header to each page
      const addHeader = (pageNum: number) => {
        doc.setFillColor(245, 245, 245); // Light gray background
        doc.rect(0, 0, doc.internal.pageSize.getWidth(), 15, 'F');
        doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.setLineWidth(0.5);
        doc.line(0, 15, doc.internal.pageSize.getWidth(), 15);
        
        doc.setFontSize(10);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text('PDF Citation Generator', 10, 10);
        
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.setFontSize(8);
        doc.text(`Citation Style: ${citationStyle}`, doc.internal.pageSize.getWidth() - 60, 10);
      };
      
      // Add footer to each page
      const addFooter = (pageNum: number, totalPages: number) => {
        doc.setFillColor(245, 245, 245);
        doc.rect(0, doc.internal.pageSize.getHeight() - 15, doc.internal.pageSize.getWidth(), 15, 'F');
        doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.setLineWidth(0.5);
        doc.line(0, doc.internal.pageSize.getHeight() - 15, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight() - 15);
        
        // Add page number
        doc.setFontSize(8);
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.text(`Page ${pageNum} of ${totalPages}`, doc.internal.pageSize.getWidth() - 30, doc.internal.pageSize.getHeight() - 5);
        
        // Add date
        const currentDate = new Date().toLocaleDateString();
        doc.text(`Generated on: ${currentDate}`, 10, doc.internal.pageSize.getHeight() - 5);
      };
      
      // Add first page header
      addHeader(1);
      
      // Set title with styling
      doc.setFontSize(18);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(`Citation for: ${filename}`, 20, 30);
      
      // Add citation content
      doc.setFontSize(11);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      
      // For rich text content, we need to strip HTML tags for PDF
      const stripHtml = (html: string) => {
        const tmp = document.createElement('DIV');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
      };
      
      // Get plain text for PDF
      const plainTextCitation = stripHtml(citationContent);
      
      // Split text into lines that fit on the page (max width ~170)
      const splitCitation = doc.splitTextToSize(plainTextCitation, 170);
      
      // Start position after title
      let yPosition = 40;
      
      // Add citation with auto page break handling
      doc.text(splitCitation, 20, yPosition);
      yPosition += doc.getTextDimensions(splitCitation).h + 15;
      
      // Add footnotes if they exist
      if (footnotes) {
        const rawFootnotesText = typeof footnotes === 'string' 
          ? footnotes 
          : Array.isArray(footnotes) 
            ? footnotes.join('\n\n')
            : '';
        
        // Process footnotes based on citation style
        const footnotesText = processBibliographyText(rawFootnotesText, citationStyle);
        
        // Check if we need a new page for footnotes
        if (yPosition > 250) {
          doc.addPage();
          addHeader(2); // Add header to the new page
          yPosition = 30; // Reset position on new page
        }
        
        // Add a divider line
        doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.setLineWidth(0.5);
        doc.line(20, yPosition - 5, 190, yPosition - 5);
        
        // Add a footnotes section header
        doc.setFontSize(14);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text('References/Footnotes:', 20, yPosition);
        yPosition += 10;
        
        // Add the footnotes content with proper formatting
        doc.setFontSize(9);
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        
        // Process footnotes based on citation style
        if (citationStyle === 'OSCOLA' || citationStyle === 'IEEE') {
          // Numbered formats: each entry on a new line with proper spacing
          const splitFootnotes = doc.splitTextToSize(footnotesText, 170);
          doc.text(splitFootnotes, 20, yPosition);
        } else {
          // APA, MLA, Chicago, or other formats with hanging indents
          const entries = footnotesText.split('\n\n');
          
          for (let i = 0; i < entries.length; i++) {
            if (entries[i].trim().length === 0) continue;
            
            // Split the current entry to fit width
            const splitEntry = doc.splitTextToSize(entries[i].trim(), 160);
            
            // Check if we need a new page
            if (yPosition + doc.getTextDimensions(splitEntry).h + 5 > doc.internal.pageSize.getHeight() - 20) {
              doc.addPage();
              addHeader(doc.getNumberOfPages());
              yPosition = 30;
            }
            
            // Add entry with proper formatting
            doc.text(splitEntry, 20, yPosition);
            
            // Update position for next entry
            yPosition += doc.getTextDimensions(splitEntry).h + 5;
          }
        }
      }
      
      // Add footers to all pages
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        addFooter(i, pageCount);
      }
      
      // Save the PDF
      doc.save(`citation_${filename.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      setError('Failed to generate PDF: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  // New function to generate DOCX from edited rich content
  const handleDownloadDOCX = async (filename: string, citation: string, footnotes?: string | string[]) => {
    // Use the potentially edited citation from editableCitations if available
    const citationContent = editableCitations[filename] || citation;
    
    try {
      // Convert footnotes to string if it's an array
      const rawFootnotesText = typeof footnotes === 'string'
        ? footnotes
        : Array.isArray(footnotes)
          ? footnotes.join('\n\n')
          : '';

      // Process footnotes based on citation style
      const footnotesText = processBibliographyText(rawFootnotesText, citationStyle);
      
      // For rich text content, we need to strip HTML tags for DOCX
      const stripHtml = (html: string) => {
        const tmp = document.createElement('DIV');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
      };
      
      // Get plain text for DOCX
      const plainTextCitation = stripHtml(citationContent);

      // Create a new docx document with professional styling
      const doc = new Document({
        title: `Citation for ${filename}`,
        description: `Citation in ${citationStyle} format`,
        styles: {
          paragraphStyles: [
            {
              id: "Heading1",
              name: "Heading 1",
              basedOn: "Normal",
              next: "Normal",
              quickFormat: true,
              run: {
                size: 28,
                bold: true,
                color: "2B5797"
              },
              paragraph: {
                spacing: {
                  after: 120
                }
              }
            },
            {
              id: "Heading2",
              name: "Heading 2",
              basedOn: "Normal",
              next: "Normal",
              quickFormat: true,
              run: {
                size: 24,
                bold: true,
                color: "2B5797"
              },
              paragraph: {
                spacing: {
                  before: 240,
                  after: 120
                }
              }
            },
            {
              id: "footnotesStyle",
              name: "Footnotes Style",
              basedOn: "Normal",
              next: "Normal",
              run: {
                size: 20
              },
              paragraph: {
                spacing: {
                  line: 276,
                  before: 20
                }
              }
            },
            {
              id: "bibliographyStyle",
              name: "Bibliography Style",
              basedOn: "Normal",
              next: "Normal",
              run: {
                size: 20
              },
              paragraph: {
                spacing: {
                  line: 276,
                  before: 20,
                  after: 120
                },
                indent: {
                  left: 0,
                  hanging: 240
                }
              }
            }
          ]
        },
        sections: [{
          properties: {
            page: {
              margin: {
                top: 1000,
                right: 1000,
                bottom: 1000,
                left: 1000
              }
            }
          },
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: `Citation Style: ${citationStyle}`,
                      size: 20,
                      color: "666666"
                    })
                  ]
                })
              ]
            })
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: `Generated on ${new Date().toLocaleDateString()}`,
                      size: 20,
                      color: "666666"
                    })
                  ]
                })
              ]
            })
          },
          children: [
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              children: [
                new TextRun({
                  text: `Citation for: ${filename}`,
                  bold: true
                })
              ]
            }),
            
            // Add some space
            new Paragraph({}),
            
            // Citation content
            new Paragraph({
              children: [
                new TextRun({
                  text: plainTextCitation,
                  size: 24
                })
              ]
            }),
            
            // Add footnotes/references if they exist
            ...(footnotesText ? [
              new Paragraph({
                heading: HeadingLevel.HEADING_2,
                children: [
                  new TextRun({
                    text: "References/Footnotes:",
                    bold: true
                  })
                ],
                spacing: {
                  before: 400
                }
              }),
              
              // Add a divider
              new Paragraph({
                border: {
                  top: {
                    color: "999999",
                    space: 1,
                    style: BorderStyle.SINGLE,
                    size: 6
                  }
                }
              }),
              
              // Process footnotes based on citation style
              ...(citationStyle === 'OSCOLA' || citationStyle === 'IEEE' ? [
                // For numbered citation styles, keep as a single paragraph
                new Paragraph({
                  style: "footnotesStyle",
                  children: [
                    new TextRun({
                      text: footnotesText,
                      size: 20
                    })
                  ]
                })
              ] : 
                // For APA, MLA, Chicago - split entries into separate paragraphs with hanging indents
                footnotesText.split('\n\n').filter(entry => entry.trim().length > 0).map(entry => 
                  new Paragraph({
                    style: "bibliographyStyle",
                    children: [
                      new TextRun({
                        text: entry.trim(),
                        size: 20
                      })
                    ],
                    spacing: {
                      after: 120
                    }
                  })
                )
              )
            ] : [])
          ]
        }]
      });

      // Generate and save the DOCX file
      const docxBlob = await Packer.toBlob(doc);
      saveAs(docxBlob, `citation_${filename.replace(/\s+/g, '_')}.docx`);
      
      console.log(`DOCX file generated for ${filename}`);
    } catch (error) {
      console.error('Error generating DOCX:', error);
      setError('Failed to generate DOCX: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  return (
    <div className="min-h-screen p-8 bg-[#F1EFEC] text-[#1e1e1e]">
      <div className="flex justify-center mb-10">
        <img 
          src="/citeme-logo.png" 
          alt="Cite Me Logo" 
          className="h-24 object-contain drop-shadow-sm" 
        />
      </div>
      
      {/* Connection status - Commented out as requested
      <div className="mb-6 max-w-7xl mx-auto">
        <div className="p-4 bg-gray-50 rounded-lg mb-4 flex gap-6 items-center justify-center">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${diagnostics.supabase ? 'bg-green-500' : 'bg-red-500'}`}></span>
            <span>Supabase</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${diagnostics.storage ? 'bg-green-500' : 'bg-red-500'}`}></span>
            <span>Storage</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${diagnostics.functions ? 'bg-green-500' : 'bg-red-500'}`}></span>
            <span>Functions</span>
          </div>
          <button 
            onClick={checkSupabaseConnection}
            className="px-4 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
          >
            Re-test Connection
          </button>
        </div>
      </div>
      */}
      
      <div className="flex gap-4 items-start max-w-7xl mx-auto">
        <div className="w-1/3">
          {/* Input Mode Toggle */}
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Upload a PDF or paste uncited text.
              </p>
              <button
                onClick={toggleInputMode}
                className="text-sm text-[#715EB7] hover:text-[#5a4a96] transition-colors px-3 py-2 bg-white rounded shadow-sm"
              >
                Switch to {inputMode === 'file' ? 'Text' : 'File'} Mode
              </button>
            </div>
          </div>
        
          {/* Master Content Input (File or Text) */}
          {inputMode === 'file' ? (
            <div className="mb-6">
              <FileUploadZone 
                onFileSelect={handleMasterFileSelect}
                selectedFiles={masterFile}
                onFileRemove={handleMasterFileRemove}
                maxFiles={1}
                description="Upload Your Masterpiece"
                showDetails={false}
              />
            </div>
          ) : (
            <div className="mb-6">
              <div className="border border-dashed border-gray-300 rounded-lg p-4 h-[200px] hover:border-gray-400 transition-colors bg-white shadow-sm">
                <textarea
                  value={masterText}
                  onChange={handleMasterTextChange}
                  placeholder="Paste your text here..."
                  className="w-full h-full p-2 resize-none focus:outline-none text-[#1e1e1e] bg-white"
                ></textarea>
              </div>
            </div>
          )}

          {/* Regular File Upload Zone */}
          <FileUploadZone 
            onFileSelect={handleFileSelect}
            selectedFiles={selectedFiles}
            onFileRemove={handleFileRemove}
            maxFiles={10}
            description="Upload Your Reference PDFs"
            showDetails={true}
          />
          
          {selectedFiles.length > 0 && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={handleGenerateCitations}
                disabled={isLoading}
                className={`
                  px-6 py-2 rounded-lg font-medium text-white
                  ${isLoading ? 'bg-[#715EB7] cursor-not-allowed opacity-50' : 'bg-[#715EB7] hover:bg-[#5a4a96]'}
                  transition-colors shadow-sm
                `}
              >
                {isLoading ? 'Processing...' : 'Cite Me!'}
              </button>
            </div>
          )}
        </div>
        <div className="w-2/3">
          <div className="mb-4">
            <p className="text-sm font-medium mb-2">Citation Style:</p>
            <div className="flex flex-wrap gap-4">
              {['APA', 'MLA', 'Chicago', 'OSCOLA', 'IEEE', 'AMA'].map((style) => (
                <label key={style} className="flex items-center">
                  <input
                    type="radio"
                    name="citationStyle"
                    value={style}
                    checked={citationStyle === style}
                    onChange={() => setCitationStyle(style)}
                    className="mr-1.5 accent-[#715EB7]"
                  />
                  <span className="text-sm">{style}</span>
                </label>
              ))}
            </div>
          </div>
          
          <div className="rounded-lg p-4 h-[600px] bg-white shadow-sm">
            <h2 className="text-lg font-semibold mb-2">Citations</h2>
            <div className="h-[calc(100%-2.5rem)] overflow-y-auto bg-[#f9f9f9] p-4 rounded">
              {error ? (
                <p className="text-red-500 text-sm whitespace-pre-wrap">{error}</p>
              ) : Object.entries(citations).length > 0 ? (
                Object.entries(citations).map(([filename, citation]) => {
                  // Get the full result object if available (for masterpiece with footnotes)
                  const resultObj = results?.find(res => res.fileName === filename);
                  const hasFootnotes = resultObj && resultObj.footnotes;
                  const isImprovedText = masterFile.length > 0 && masterFile[0].name === filename;
                  
                  return (
                    <div key={filename} className="mb-6 last:mb-0">
                      <div className="flex justify-between items-center mb-1">
                        <p className="font-medium text-gray-700">
                          {isImprovedText ? '📄 Your Masterpiece:' : `🔖 ${filename}:`}
                        </p>
                        
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleDownloadPDF(
                              filename,
                              citation,
                              resultObj?.footnotes
                            )}
                            className="px-3 py-1 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors flex items-center shadow-sm"
                          >
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            PDF
                          </button>
                          
                          <button
                            onClick={() => handleDownloadDOCX(
                              filename,
                              citation,
                              resultObj?.footnotes
                            )}
                            className="px-3 py-1 text-xs text-white bg-green-600 hover:bg-green-700 rounded transition-colors flex items-center shadow-sm"
                          >
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2" />
                            </svg>
                            Word
                          </button>
                        </div>
                      </div>
                      
                      {isImprovedText ? (
                        <div className="mb-4">
                          <div className="mb-2">
                            <RichTextEditor 
                              initialValue={editableCitations[filename] || citation} 
                              onSave={(content) => handleSaveCitation(filename, content)}
                              readOnly={false}
                              height={200}
                              className="citation-editor citation-editor-masterpiece"
                              placeholder="Edit citation content..."
                            />
                          </div>
                          {citation.includes("No text improvements needed") ? (
                            <p className="text-sm text-green-600 italic">✓ No citation issues found</p>
                          ) : (
                            <p className="text-sm text-amber-600 italic">⚠️ Text has been improved with proper citations</p>
                          )}
                          
                          {/* Display footnotes if available */}
                          {hasFootnotes && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <p className="font-medium text-sm text-gray-700 mb-2">References/Footnotes:</p>
                              <div className="whitespace-pre-wrap text-sm text-gray-700 pl-2 border-l-2 border-blue-300 bg-[#f0f7ff] p-3 rounded shadow-sm">
                                {typeof resultObj.footnotes === 'string' 
                                  ? resultObj.footnotes 
                                  : Array.isArray(resultObj.footnotes) 
                                    ? resultObj.footnotes.join('\n\n')
                                    : ''}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <RichTextEditor 
                          initialValue={editableCitations[filename] || citation} 
                          onSave={(content) => handleSaveCitation(filename, content)}
                          readOnly={false}
                          height={150}
                          className="citation-editor"
                          placeholder="Edit citation content..."
                        />
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-gray-500">Upload PDFs to generate citations.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add the test component at the bottom - Commented out as requested
      <div className="max-w-7xl mx-auto mt-10">
        <EdgeFunctionTest />
      </div>
      */}
    </div>
  );
}
