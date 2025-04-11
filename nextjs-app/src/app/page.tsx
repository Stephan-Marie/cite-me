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

// Add this interface at the top of the file alongside the other interfaces
interface EdgeFunctionRequest {
  pdfUrls: { url: string; fileName: string }[];
  citationStyle?: string;
  masterpiece?: { url: string; fileName: string } | { text: string; fileName: string };
}

// Helper function to process bibliography entries based on citation style
const processBibliographyText = (text: string, style: string): string => {
  if (!text) return '';
  
  // Simply return the text as received from the edge function
  // The edge function is responsible for proper formatting and separation
  return text;
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
  const [richTextContent, setRichTextContent] = useState<Record<string, string>>({});
  const primaryColor: [number, number, number] = [116, 105, 182]; // RGB for #7469B6
  const [feedbackMessage, setFeedbackMessage] = useState('');

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
                newCitations[result.fileName] = result.citation;
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
                  newCitations[result.fileName] = result.citation;
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

  // New function to generate and download PDF
  const handleDownloadPDF = (fileName: string, citation: string, footnotes?: string | string[]) => {
    try {
      const doc = new jsPDF();
      const title = `Citation (${citationStyle}) - ${new Date().toLocaleDateString()}`;
      
      doc.setFontSize(16);
      doc.text(title, 20, 20);
      
      doc.setFontSize(12);
      
      // Use rich text content if available, otherwise use plain citation
      let contentToUse = richTextContent[fileName] || citation;
      
      // Clean up content - remove HTML tags and HTTP marks
      contentToUse = contentToUse
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/http[s]?:\/\/[^\s]+/g, '') // Remove URLs
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      
      // Handle text wrapping for citation
      const maxWidth = 170;
      const citationLines = [];
      let text = contentToUse;
      
      while (text.length > 0) {
        // Find the position to split the text based on max width
        let splitPoint = text.length;
        for (let i = 0; i < text.length; i++) {
          const textWidth = doc.getStringUnitWidth(text.substring(0, i + 1)) * 12 * 0.352778;
          if (textWidth > maxWidth) {
            splitPoint = Math.max(text.lastIndexOf(' ', i), 0);
            if (splitPoint === 0) splitPoint = i;
            break;
          }
        }
        
        // Add the line and remove it from the text
        citationLines.push(text.substring(0, splitPoint));
        text = text.substring(splitPoint).trim();
      }
      
      // Start the citation text at y-position 40
      let yPos = 40;
      
      // Add a new page if the citation is too long
      if (citationLines.length > 15) {
        doc.addPage();
        yPos = 20;
      }
      
      citationLines.forEach((line) => {
        doc.text(line, 20, yPos);
        yPos += 7;
      });
      
      // Add footnotes if they exist
      if (footnotes) {
        // Check if we need a new page
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }
        
        yPos += 10;
        doc.setFontSize(14);
        doc.text('References:', 20, yPos);
        doc.setFontSize(10);
        
        yPos += 7;
        
        let footnotesText = Array.isArray(footnotes) ? footnotes.join('\n\n') : footnotes;
        
        // Clean up footnotes content
        footnotesText = footnotesText
          .replace(/<[^>]*>/g, '') // Remove HTML tags
          .replace(/http[s]?:\/\/[^\s]+/g, '') // Remove URLs
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();
        
        // Handle text wrapping for footnotes
        const footnoteLines = [];
        let footText = footnotesText;
        
        while (footText.length > 0) {
          let splitPoint = footText.length;
          for (let i = 0; i < footText.length; i++) {
            const textWidth = doc.getStringUnitWidth(footText.substring(0, i + 1)) * 10 * 0.352778;
            if (textWidth > maxWidth) {
              splitPoint = Math.max(footText.lastIndexOf(' ', i), 0);
              if (splitPoint === 0) splitPoint = i;
              break;
            }
          }
          
          footnoteLines.push(footText.substring(0, splitPoint));
          footText = footText.substring(splitPoint).trim();
        }
        
        footnoteLines.forEach((line) => {
          // Add a new page if we're near the bottom
          if (yPos > 280) {
            doc.addPage();
            yPos = 20;
          }
          
          doc.text(line, 20, yPos);
          yPos += 5;
        });
      }
      
      // Add page numbers
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(10);
        doc.text(`Page ${i} of ${totalPages}`, 20, 290);
      }
      
      // Save with a formatted filename
      const sanitizedFileName = fileName.replace(/[^\w\s.-]/g, '_');
      doc.save(`citation_${sanitizedFileName}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      setError('Failed to generate PDF: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  // New function to generate and download .docx file
  const handleDownloadDOCX = async (filename: string, citation: string, footnotes?: string | string[]) => {
    try {
      // Use rich text content if available, otherwise use plain citation
      let contentToUse = richTextContent[filename] || citation;
      
      // Clean up content - remove HTML tags and HTTP marks
      contentToUse = contentToUse
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/http[s]?:\/\/[^\s]+/g, '') // Remove URLs
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      
      let footnotesToUse = footnotes ? (richTextContent[`${filename}_footnotes`] || 
        (typeof footnotes === 'string' ? footnotes : footnotes.join('\n\n'))) : '';
      
      // Clean up footnotes content
      footnotesToUse = footnotesToUse
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/http[s]?:\/\/[^\s]+/g, '') // Remove URLs
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();

      // Process footnotes based on citation style
      const footnotesText = processBibliographyText(footnotesToUse, citationStyle);

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
                  text: contentToUse,
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

  // Add this function to handle rich text changes
  const handleRichTextChange = (filename: string, content: string) => {
    // When citation style changes, we need to update the content with the new format
    if (content.includes('mce-annotation')) {
      // If the content has annotations, we need to preserve them while updating the citation format
      const updatedContent = prepareRichTextCitation(content);
      setRichTextContent(prev => ({
        ...prev,
        [filename]: updatedContent
      }));
    } else {
      // For plain text content, just update it directly
      setRichTextContent(prev => ({
        ...prev,
        [filename]: content
      }));
    }
  };

  const prepareRichTextCitation = (content: string) => {
    // Create a temporary div to parse the HTML content
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;

    // Find all citation annotations
    const citations = tempDiv.querySelectorAll('[data-mce-annotation]');
    
    citations.forEach(citation => {
      const annotation = citation.getAttribute('data-mce-annotation');
      if (annotation) {
        const citationData = JSON.parse(annotation);
        const citationText = citationData.text;
        
        // Format the citation based on the selected style
        let formattedCitation = '';
        switch (citationStyle) {
          case 'OSCOLA':
            formattedCitation = `[${citationText}]`;
            break;
          case 'APA':
            formattedCitation = `(${citationText})`;
            break;
          case 'MLA':
            formattedCitation = `(${citationText})`;
            break;
          case 'Chicago':
            formattedCitation = `(${citationText})`;
            break;
          case 'IEEE':
            formattedCitation = `[${citationText}]`;
            break;
          default:
            formattedCitation = `(${citationText})`;
        }

        // Update the citation text
        citation.textContent = formattedCitation;
      }
    });

    return tempDiv.innerHTML;
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
            <h2 className="text-lg font-semibold mb-2">Your Content</h2>
            <p className="text-sm text-gray-500 mb-4">
              {inputMode === 'file' 
                ? 'Upload a PDF to check for proper citations' 
                : 'Paste your text to check for proper citations'}
            </p>
            <button
              onClick={toggleInputMode}
              className="text-sm text-[#7469B6] hover:text-[#5A4F8C] transition-colors px-3 py-2 bg-white rounded shadow-sm"
            >
              Switch to {inputMode === 'file' ? 'Text' : 'File'} Mode
            </button>
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
                isLoading={isLoading}
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
                  disabled={isLoading}
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
            isLoading={isLoading}
          />
          
          {selectedFiles.length > 0 && (
            <div className="mt-4 flex flex-col items-center gap-4">
              <button
                onClick={handleGenerateCitations}
                disabled={isLoading}
                className={`
                  px-6 py-2 rounded-lg font-medium text-white
                  ${isLoading 
                    ? 'bg-[#7469B6] bg-opacity-50 cursor-not-allowed' 
                    : 'bg-[#7469B6] hover:bg-[#5A4F8C]'}
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
              
              {isLoading && (
                <div className="flex flex-col items-center gap-2">
                  <div className="relative w-8 h-8">
                    <div className="absolute top-0 left-0 w-full h-full border-2 border-[#7469B6] border-opacity-20 rounded-full"></div>
                    <div className="absolute top-0 left-0 w-full h-full border-2 border-[#7469B6] rounded-full border-t-transparent animate-spin"></div>
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                      <div className="w-1 h-1 bg-[#7469B6] rounded-full animate-ping"></div>
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <p className="text-xs font-medium text-gray-700">Checking for references</p>
                    <p className="text-[10px] text-gray-500">This can take up to a few minutes...</p>
                  </div>
                </div>
              )}
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
                            className="px-3 py-1 text-xs text-white bg-[#7469B6] hover:bg-[#5A4F8C] rounded transition-colors flex items-center shadow-sm"
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
                            className="px-3 py-1 text-xs text-white bg-[#7469B6] hover:bg-[#5A4F8C] rounded transition-colors flex items-center shadow-sm"
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
                          <div className="text-sm text-gray-800 bg-white p-3 border border-[#7469B6] border-opacity-20 rounded mb-2 shadow-sm">
                            <RichTextEditor
                              initialValue={citation}
                              onChange={(content) => handleRichTextChange(filename, content)}
                              height={200}
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
                              <div className="text-sm text-gray-700 pl-2 border-l-2 border-[#9ACBD0] bg-[#f0f7ff] p-3 rounded shadow-sm">
                                <RichTextEditor
                                  initialValue={typeof resultObj.footnotes === 'string' 
                                    ? resultObj.footnotes 
                                    : Array.isArray(resultObj.footnotes) 
                                      ? resultObj.footnotes.join('\n\n')
                                      : ''}
                                  onChange={(content) => handleRichTextChange(`${filename}_footnotes`, content)}
                                  height={150}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-600 pl-2 border-l-2 border-[#9ACBD0] bg-white p-3 rounded shadow-sm">
                          <RichTextEditor
                            initialValue={citation}
                            onChange={(content) => handleRichTextChange(filename, content)}
                            height={150}
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

      {/* Feedback Form */}
      <div className="mt-16 max-w-7xl mx-auto p-4">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-[#7469B6] mb-4">Leave Feedback</h3>
          <form onSubmit={async (e) => {
            e.preventDefault();
            
            if (feedbackMessage.length > 35) {
              setError('Message must be 35 characters or less');
              return;
            }

            try {
              // Create a unique filename
              const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
              const filename = `feedback_${timestamp}.txt`;
              
              // Convert message to blob
              const blob = new Blob([feedbackMessage], { type: 'text/plain' });
              
              // Upload to Supabase storage
              const { error: uploadError } = await supabase.storage
                .from('feedback')
                .upload(filename, blob);

              if (uploadError) throw uploadError;
              
              // Clear form and show success message
              setFeedbackMessage('');
              setError('Thank you for your feedback!');
              setTimeout(() => setError(''), 3000);
            } catch (err) {
              setError('Failed to submit feedback. Please try again.');
            }
          }}>
            <div className="mb-4">
              <textarea
                value={feedbackMessage}
                onChange={(e) => setFeedbackMessage(e.target.value)}
                maxLength={35}
                placeholder="Your feedback (max 35 characters)"
                className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#7469B6] focus:border-transparent"
                rows={3}
              />
              <p className="text-sm text-gray-500 mt-1">
                {35 - feedbackMessage.length} characters remaining
              </p>
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-[#7469B6] text-white rounded hover:bg-[#5A4F8C] transition-colors"
            >
              Submit Feedback
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
