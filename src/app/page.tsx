'use client';

import { useState, useEffect } from 'react';
import FileUploadZone from '../components/FileUploadZone';
import { supabase } from '../lib/supabase';
import EdgeFunctionTest from '../components/EdgeFunctionTest';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle, AlignmentType, Table, TableRow, TableCell, WidthType, Header, Footer } from 'docx';
import { saveAs } from 'file-saver';
import CitationEditor from '../components/CitationEditor';

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

// Helper function to process text and add citation highlighting
const processTextWithCitations = (text: string): string => {
  if (!text) return '';
  
  // Look for common citation patterns and wrap them with the in-text-citation class
  // This regex looks for patterns like (Author, Year), [1], etc.
  const citationPatterns = [
    // Author-year format like (Smith, 2020)
    /\(([A-Za-z\s]+,\s*\d{4})\)/g,
    // Numbered format like [1] or [1,2,3]
    /\[\d+(?:,\s*\d+)*\]/g,
    // Footnote format like ¹ or ²
    /[¹²³⁴⁵⁶⁷⁸⁹⁰]/g,
    // Superscript numbers like 1, 2, 3
    /<sup>\d+<\/sup>/g
  ];
  
  let processedText = text;
  
  // Apply each pattern
  citationPatterns.forEach(pattern => {
    processedText = processedText.replace(pattern, match => 
      `<span class="in-text-citation">${match}</span>`
    );
  });
  
  return processedText;
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
  const [results, setResults] = useState<EdgeFunctionResult[]>([]);

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
      const { error: supabaseError } = await supabase.from('dummy').select('*').limit(1).maybeSingle();
      // We expect an error about the table not existing, but not a connection error
      results.supabase = !supabaseError || supabaseError.code !== 'PGRST301';
      
      // Test storage
      try {
        const { data: storageData } = await supabase.storage.getBucket('pdfs');
        results.storage = !!storageData;
      } catch (error) {
        // Try listing buckets as fallback
        const { data: buckets } = await supabase.storage.listBuckets();
        results.storage = Array.isArray(buckets);
      }
      
      // Test functions
      try {
        // Try to ping a specific function instead of listing
        await supabase.functions.invoke('extract-pdf-metadata', {
          body: { test: true }
        });
        results.functions = true;
      } catch (funcError) {
        console.log('Function test error:', funcError);
        results.functions = false;
      }
    } catch (error) {
      console.error('Connection test error:', error);
    }
    
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
          
          // Process results
          if (response.data && response.data.results && Array.isArray(response.data.results)) {
            setResults(response.data.results);
            
            response.data.results.forEach((result: EdgeFunctionResult) => {
              if (result && result.fileName && result.citation) {
                // Process the citation text to add highlighting
                const processedCitation = processTextWithCitations(result.citation);
                newCitations[result.fileName] = processedCitation;
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
                  // Process the citation text to add highlighting
                  const processedCitation = processTextWithCitations(result.citation);
                  newCitations[result.fileName] = processedCitation;
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
    } catch (err) {
      console.error('Citation generation error:', err);
      setError('Failed to process files: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  // This function is new - it strips HTML tags for PDF/DOCX export
  const stripHtmlTags = (html: string): string => {
    if (!html) return '';
    return html.replace(/<\/?[^>]+(>|$)/g, '');
  };

  // Modify the PDF handler to handle HTML content
  const handleDownloadPDF = (fileName: string, citation: string, footnotes?: string | string[]) => {
    try {
      // Create a new PDF document
      const doc = new jsPDF();
      
      // Set document properties
      doc.setProperties({
        title: `Citation for ${fileName}`,
        subject: 'Citation',
        author: 'Cite Me',
        keywords: 'citation, reference, bibliography',
        creator: 'Cite Me PDF Citation Generator'
      });
      
      // Add title
      doc.setFontSize(16);
      doc.text(`Citation for: ${fileName}`, 20, 20);
      
      // Add citation style and date
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Style: ${citationStyle} | Generated: ${new Date().toLocaleDateString()}`, 20, 30);
      
      // Process the citation text to add highlighting
      const processedCitation = processTextWithCitations(citation);
      
      // Add citation content
      doc.setFontSize(12);
      doc.setTextColor(0);
      
      // Split the citation into lines that fit the page width
      const lines = doc.splitTextToSize(processedCitation, 170);
      
      // Check if we need a new page for the citation
      let y = 40;
      if (lines.length > 20) {
        doc.addPage();
        y = 20;
      }
      
      // Add the citation text
      doc.text(lines, 20, y);
      
      // Add footnotes if they exist
      if (footnotes) {
        // Check if we need a new page for footnotes
        if (y + (lines.length * 7) > 250) {
          doc.addPage();
          y = 20;
        } else {
          y = y + (lines.length * 7) + 10;
        }
        
        // Add footnotes header
        doc.setFontSize(14);
        doc.text('References/Footnotes:', 20, y);
        y += 10;
        
        // Process footnotes text
        let footnotesText = '';
        if (Array.isArray(footnotes)) {
          footnotesText = footnotes.join('\n\n');
        } else {
          footnotesText = footnotes;
        }
        
        // Split footnotes into lines
        const footnotesLines = doc.splitTextToSize(footnotesText, 170);
        
        // Add the footnotes text
        doc.setFontSize(12);
        doc.text(footnotesLines, 20, y);
      }
      
      // Add page numbers
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width - 40, doc.internal.pageSize.height - 10, { align: 'right' });
      }
      
      // Save the PDF
      doc.save(`citation_${fileName.replace(/\.[^/.]+$/, '')}.pdf`);
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      setError(`Failed to generate PDF: ${error.message || 'Unknown error'}`);
    }
  };

  // Modify the DOCX handler to handle HTML content
  const handleDownloadDOCX = async (filename: string, citation: string, footnotes?: string | string[]) => {
    try {
      // Strip HTML tags for DOCX generation
      const plainTextCitation = stripHtmlTags(citation);
      
      // Convert footnotes to string if it's an array
      const rawFootnotesText = typeof footnotes === 'string'
        ? footnotes
        : Array.isArray(footnotes)
          ? footnotes.join('\n\n')
          : '';

      // Process footnotes based on citation style
      const footnotesText = processBibliographyText(rawFootnotesText, citationStyle);

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
    <div className="min-h-screen p-8 bg-[#f7f7f7] text-[#1e1e1e]">
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
              <h2 className="text-lg font-semibold">Your Content</h2>
              <button
                onClick={toggleInputMode}
                className="text-sm text-blue-600 hover:text-blue-800 transition-colors px-3 py-2 bg-white rounded shadow-sm"
              >
                Switch to {inputMode === 'file' ? 'Text' : 'File'} Mode
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-2">
              {inputMode === 'file' 
                ? 'Upload a PDF to check for proper citations' 
                : 'Paste your text to check for proper citations'}
            </p>
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
                  ${isLoading 
                    ? 'bg-blue-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700'}
                  transition-colors shadow-sm
                `}
              >
                {isLoading 
                  ? `Processing...` 
                  : inputMode === 'file' && masterFile.length > 0
                    ? `Cite ${selectedFiles.length + 1} Files!`
                    : inputMode === 'text' && masterText.trim() !== ''
                      ? `Cite Text & ${selectedFiles.length} Reference${selectedFiles.length > 1 ? 's' : ''}!`
                      : `Cite ${selectedFiles.length} Reference${selectedFiles.length > 1 ? 's' : ''}!`}
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
                    className="mr-1.5"
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
                          <div className="border border-blue-200 rounded mb-2 shadow-sm">
                            <CitationEditor 
                              content={citation} 
                              readOnly={true} 
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
                        <div className="border border-gray-200 rounded shadow-sm">
                          <CitationEditor 
                            content={citation} 
                            readOnly={true} 
                          />
                        </div>
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
