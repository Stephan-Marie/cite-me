// File: extract-pdf-metadata.ts
// Define types
// CORS headers function
function corsHeaders(req) {
  const origin = req.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Content-Length, Accept, X-Supabase-Client, X-Supabase-Version',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'true'
  };
}
// Define citation style rules
const citationStyleRules = {
  OSCOLA: {
    inTextFormat: 'footnote numbers in superscript',
    referenceFormat: 'footnotes at the bottom of the page. A new paragraph for each citation',
    example: '[1] Smith v Jones [2020] UKSC 1'
  },
  APA: {
    inTextFormat: 'author-date in parentheses',
    referenceFormat: 'alphabetical bibliography. A new paragraph for each citation',
    example: '(Smith, 2020)'
  },
  MLA: {
    inTextFormat: 'author-page in parentheses',
    referenceFormat: 'alphabetical works cited. A new paragraph for each citation',
    example: '(Smith 42)'
  },
  IEEE: {
    inTextFormat: 'numbered references in square brackets',
    referenceFormat: 'numbered bibliography. A new paragraph for each citation',
    example: '[1]'
  },
  Chicago: {
    inTextFormat: 'author-date or footnote numbers',
    referenceFormat: 'bibliography or footnotes. A new paragraph for each citation',
    example: '(Smith 2020) or [1]'
  },
  AMA: {
    inTextFormat: 'numbered references in superscript',
    referenceFormat: 'numbered bibliography. A new paragraph for each citation',
    example: '¹'
  }
};
// Supabase Edge Function handler
export default async function handler(req) {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(req)
    });
  }
  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      error: 'Method not allowed'
    }), {
      status: 405,
      headers: {
        ...corsHeaders(req),
        'Content-Type': 'application/json'
      }
    });
  }
  try {
    // Parse request data
    const text = await req.text();
    console.log('Request received:', text.substring(0, 200) + '...');
    // Handle test requests
    if (text.includes('"test":true')) {
      return new Response(JSON.stringify({
        status: "Function is operational",
        message: "This is a test response to confirm the function is working",
        citations: "Test citation for a PDF document."
      }), {
        headers: {
          ...corsHeaders(req),
          'Content-Type': 'application/json'
        }
      });
    }
    let requestData;
    try {
      requestData = JSON.parse(text);
    } catch (parseError) {
      return new Response(JSON.stringify({
        error: `Failed to parse request body: ${parseError.message}`
      }), {
        status: 400,
        headers: {
          ...corsHeaders(req),
          'Content-Type': 'application/json'
        }
      });
    }
    const { pdfUrls } = requestData;
    if (!pdfUrls || !Array.isArray(pdfUrls) || pdfUrls.length === 0) {
      return new Response(JSON.stringify({
        error: 'PDF URLs array is required'
      }), {
        status: 400,
        headers: {
          ...corsHeaders(req),
          'Content-Type': 'application/json'
        }
      });
    }
    // Get citation style from the request or use default
    const citationStyle = requestData.citationStyle || 'OSCOLA';
    // Validate citation style
    const validCitationStyles = [
      'OSCOLA',
      'APA',
      'MLA',
      'IEEE',
      'Chicago',
      'AMA'
    ];
    if (!validCitationStyles.includes(citationStyle)) {
      return new Response(JSON.stringify({
        error: `Invalid citation style. Must be one of: ${validCitationStyles.join(', ')}`
      }), {
        status: 400,
        headers: {
          ...corsHeaders(req),
          'Content-Type': 'application/json'
        }
      });
    }
    console.log(`Using citation style: ${citationStyle}`);
    // Check for masterpiece file
    const masterpiece = requestData.masterpiece || null;
    let masterpieceData = null;
    let masterpieceImage = null;
    if (masterpiece && masterpiece.url && masterpiece.fileName) {
      console.log(`Masterpiece file identified: ${masterpiece.fileName}`);
      try {
        // Process masterpiece file
        masterpieceImage = await getPdfScreenshot(masterpiece.url);
        if (masterpieceImage) {
          masterpieceData = {
            fileName: masterpiece.fileName,
            imageData: masterpieceImage
          };
          console.log(`Masterpiece image successfully processed`);
        } else {
          console.error(`Failed to generate masterpiece screenshot`);
        }
      } catch (error) {
        console.error(`Error processing masterpiece:`, error);
      }
    }
    // Process each reference PDF to get their images
    const results = [];
    const errors = [];
    const referenceImages = [];
    for (const pdfData of pdfUrls){
      const { url: pdfUrl, fileName = 'document.pdf' } = pdfData;
      try {
        // Get PDF screenshot using Browserless
        console.log(`Processing reference PDF: ${fileName}`);
        const imageData = await getPdfScreenshot(pdfUrl);
        if (!imageData) {
          errors.push({
            fileName,
            error: 'Failed to generate PDF screenshot - no image data returned'
          });
          continue;
        }
        // Store reference data for later comparison
        referenceImages.push({
          fileName,
          imageData
        });
        // If no masterpiece, just generate a citation for this reference
        if (!masterpieceData) {
          const citation = await generateCitation(imageData, fileName, citationStyle);
          results.push({
            fileName,
            citation
          });
        }
      } catch (error) {
        console.error(`Error processing PDF ${fileName}:`, error);
        errors.push({
          fileName,
          error: error.message || 'Unknown error occurred'
        });
      }
    }
    // If we have both masterpiece and references, perform comparison
    if (masterpieceData && referenceImages.length > 0) {
      try {
        console.log(`Comparing masterpiece with ${referenceImages.length} references`);
        const analysisResults = await compareMasterpieceWithReferences(masterpieceData, referenceImages, citationStyle);
        // Add the masterpiece with improved text and footnotes as a single result
        results.push({
          fileName: masterpieceData.fileName,
          citation: analysisResults.improvedText || "No text improvements needed",
          analysis: analysisResults.analysis || "No issues found",
          footnotes: analysisResults.footnotes || []
        });
      } catch (error) {
        console.error(`Error during comparison analysis:`, error);
        errors.push({
          fileName: masterpieceData.fileName,
          error: `Comparison analysis failed: ${error.message || 'Unknown error'}`
        });
      }
    }
    // Return combined results
    return new Response(JSON.stringify({
      results,
      errors: errors.length > 0 ? errors : undefined
    }), {
      headers: {
        ...corsHeaders(req),
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error processing PDF:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Unknown error occurred'
    }), {
      status: 500,
      headers: {
        ...corsHeaders(req),
        'Content-Type': 'application/json'
      }
    });
  }
}
// Get PDF content and metadata directly using PDF.js
async function getPdfContent(pdfUrl) {
  try {
    // Fetch the PDF file
    const response = await fetch(pdfUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
    }
    
    // Get the PDF data as ArrayBuffer
    const pdfData = await response.arrayBuffer();
    
    // Initialize PDF.js
    const pdfjsLib = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    
    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({ data: pdfData });
    const pdf = await loadingTask.promise;
    
    // Get the first page
    const page = await pdf.getPage(1);
    
    // Get page dimensions
    const viewport = page.getViewport({ scale: 1.0 });
    
    // Create a canvas to render the page
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    // Render the page
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;
    
    // Extract text content
    const textContent = await page.getTextContent();
    const text = textContent.items.map(item => item.str).join(' ');
    
    // Get metadata
    const metadata = await pdf.getMetadata();
    
    // Convert canvas to base64 image
    const imageData = canvas.toDataURL('image/png');
    
    return {
      text,
      metadata: metadata?.info || {},
      imageData
    };
  } catch (error) {
    console.error('Error processing PDF:', error);
    throw error;
  }
}
// Extract citation from image using OpenAI vision model
async function extractCitationsFromImage(imageData, fileName, citationStyle = 'OSCOLA', masterpieceFileName = null) {
  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key is not set');
    }
    console.log(`Sending image to OpenAI for ${citationStyle} citation extraction`);
    // Prepare prompt text
    let promptText = `You are a citation generator. Examine this image of a PDF document's first page and generate only a ${citationStyle} format citation.`;
    // Add masterpiece reference if provided
    if (masterpieceFileName) {
      promptText += ` This source will be cited in a document titled "${masterpieceFileName}".`;
    }
    promptText += ` Return only the citation text without any additional comments or explanations.`;
    // Prepare message with the image data
    const messages = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: promptText
          },
          {
            type: 'image_url',
            image_url: {
              url: imageData
            }
          }
        ]
      }
    ];
    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        temperature: 0.3,
        max_tokens: 500
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
    }
    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error extracting citations from image:', error);
    throw error;
  }
}
// Generate citation for a single reference document
async function generateCitation(imageData, fileName, citationStyle = 'OSCOLA') {
  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key is not set');
    }
    console.log(`Generating citation for ${fileName} in ${citationStyle} style`);
    // Use the global citationStyleRules for consistent formatting
    const styleRule = citationStyleRules[citationStyle];
    if (!styleRule) {
      throw new Error(`Invalid citation style: ${citationStyle}`);
    }
    const promptText = `You are a citation generator. Examine this image of a PDF document's first page and generate a citation in ${citationStyle} format.

IMPORTANT FORMATTING RULES:
- For in-text citations: ${styleRule.inTextFormat}
- For reference list: ${styleRule.referenceFormat}
- Example format: ${styleRule.example}

DO NOT use numbered citations (like ¹) unless the style specifically requires it (like IEEE or AMA or OSCOLA).
For APA and MLA, always use author-date or author-page format respectively.

Return a JSON object with the citation text without any additional comments or explanations.`;
    // Prepare message with the image data
    const messages = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: promptText
          },
          {
            type: 'image_url',
            image_url: {
              url: imageData
            }
          }
        ]
      }
    ];
    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: messages,
        temperature: 0.1,
        max_tokens: 500,
        response_format: {
          type: "json_object"
        }
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
    }
    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error generating citation:', error);
    throw error;
  }
}
// Compare masterpiece with reference documents
async function compareMasterpieceWithReferences(masterpiece, references, citationStyle) {
  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key is not set');
    }
    console.log(`Comparing masterpiece with ${references.length} references for ${citationStyle} citations`);
    // Get the style rules for the current citation style
    const styleRule = citationStyleRules[citationStyle];
    if (!styleRule) {
      throw new Error(`Invalid citation style: ${citationStyle}`);
    }
    // Prepare messages with all images
    const contentItems = [
      {
        type: 'text',
        text: `You are a citation and plagiarism expert. I will show you multiple PDF images.
        
First, I'll show you the main document titled "${masterpiece.fileName}" followed by ${references.length} reference documents.

Your task is to analyze the documents and return a JSON response with exactly these fields:

1. improvedText: The main document text with proper in-text citations in ${citationStyle} format. 
   - Format: ${styleRule.inTextFormat}
   - Example: ${styleRule.example}
   - If any in-text citation is added, wrap the bracketed information or reference numbers in <mark class="uncited">...</mark> tags using my TinyMCE API.
   - DO NOT use numbered citations (like ¹) unless the style specifically requires it (like IEEE or AMA or OSCOLA).
   - For APA and MLA, always use author-date or author-page format respectively.
   - Accuracy is HIGH PRIORITY. In-text citations should be placed next to the correct sentences.

2. footnotes: A complete, consolidated list of all references in proper ${citationStyle} format.
   - Format: ${styleRule.referenceFormat}
   - Each citation MUST be on its own paragraph, separated by double line breaks (\n\n)
   - For ${citationStyle}, ensure proper ordering and formatting:
     ${citationStyle === 'OSCOLA' ? '- Use numbered footnotes with proper legal citation format\n- Include case names in italics\n- Include statute names in italics\n- Each footnote must be on its own paragraph, separated by double line breaks' : citationStyle === 'APA' ? '- Alphabetical order by author surname\n- Include DOI or URL if available\n- Use hanging indent format\n- Each reference must be on its own paragraph, separated by double line breaks' : citationStyle === 'MLA' ? '- Alphabetical order by author surname\n- Use hanging indent format\n- Include medium of publication\n- Each work cited entry must be on its own paragraph, separated by double line breaks' : citationStyle === 'IEEE' ? '- Numbered references in order of appearance\n- Include DOI if available\n- Use square brackets for in-text citations\n- Each reference must be on its own paragraph, separated by double line breaks' : citationStyle === 'Chicago' ? '- Use either author-date or footnote style consistently\n- Include URL or DOI if available\n- Use hanging indent format\n- Each citation must be on its own paragraph, separated by double line breaks' : '- Numbered references in order of appearance\n- Include DOI if available\n- Use superscript numbers for in-text citations\n- Each reference must be on its own paragraph, separated by double line breaks'}

IMPORTANT RULES:
- Always return a complete JSON object with all required fields
- If no changes are needed, set improvedText to "No changes needed for ${citationStyle} format"
- If no footnotes are needed, set footnotes to "No footnotes required"
- Ensure all citations match the ${citationStyle} format exactly
- Do not include any text outside the JSON structure
- DO NOT use numbered citations for APA or MLA styles
- Citations MUST be separated by double line breaks (\n\n)
- For APA, use (Author, Year) format
- For MLA, use (Author Page) format
- For Chicago, use either author-date or footnote style consistently
- For OSCOLA, use numbered footnotes in superscript
- For IEEE and AMA, use numbered references
- Each citation MUST be on its own paragraph with double line breaks before and after

Now, here's the main document image, followed by reference documents:`
      },
      {
        type: 'image_url',
        image_url: {
          url: masterpiece.imageData
        }
      }
    ];
    // Add all reference images
    for (const ref of references){
      contentItems.push({
        type: 'text',
        text: `Reference document: ${ref.fileName}`
      });
      contentItems.push({
        type: 'image_url',
        image_url: {
          url: ref.imageData
        }
      });
    }
    const messages = [
      {
        role: 'user',
        content: contentItems
      }
    ];
    // Call OpenAI API with increased tokens for this complex task
    console.log(`Sending request to OpenAI for ${citationStyle} citation analysis`);
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: messages,
        temperature: 0.1,
        max_tokens: 4000,
        response_format: {
          type: "json_object"
        },
        presence_penalty: 0.1,
        frequency_penalty: 0.1,
        top_p: 0.9
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
    }
    console.log(`Received response from OpenAI for ${citationStyle} citation analysis`);
    // Parse the response JSON
    const data = await response.json();
    // Add robust error handling for null/undefined content
    if (!data || !data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Invalid OpenAI response structure:', JSON.stringify(data).substring(0, 200));
      throw new Error(`Invalid response structure from OpenAI for ${citationStyle} citations`);
    }
    // Check if content exists
    if (!data.choices[0].message.content) {
      console.error('Empty content in OpenAI response:', JSON.stringify(data.choices[0]).substring(0, 200));
      console.error('Full response data structure:', JSON.stringify(data).substring(0, 500));
      console.error('Response status details:', {
        model: data.model,
        object: data.object,
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
        totalTokens: data.usage?.total_tokens
      });
      throw new Error(`Empty content received from OpenAI for ${citationStyle} citation style`);
    }
    // Get content safely
    const content = data.choices[0].message.content;
    console.log(`Response content type: ${typeof content}, length: ${typeof content === 'string' ? content.length : 'N/A'}`);
    try {
      // Sometimes the model might return already parsed JSON
      if (typeof content === 'object' && content !== null) {
        console.log('Content is already a JSON object');
        // Validate and ensure all required fields exist
        const validatedContent = {
          improvedText: content.improvedText || `No changes needed for ${citationStyle} format`,
          footnotes: content.footnotes || 'No footnotes required',
          analysis: content.analysis || 'No analysis required'
        };
        return validatedContent;
      }
      // Parse JSON string
      if (typeof content === 'string') {
        const parsedContent = JSON.parse(content);
        // Validate and ensure all required fields exist
        const validatedContent = {
          improvedText: parsedContent.improvedText || `No changes needed for ${citationStyle} format`,
          footnotes: parsedContent.footnotes || 'No footnotes required',
          analysis: parsedContent.analysis || 'No analysis required'
        };
        return validatedContent;
      }
      // Fallback for unexpected content type
      throw new Error(`Unexpected content type from OpenAI: ${typeof content}`);
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', {
        error: parseError.message,
        contentPreview: typeof content === 'string' ? content.substring(0, 200) : JSON.stringify(content).substring(0, 200)
      });
      // Provide a structured fallback response with all required fields
      return {
        improvedText: `Could not process the document using ${citationStyle} citation style. Please try again or use a different citation style.`,
        footnotes: 'Unable to generate footnotes due to processing error.',
        analysis: `Error processing response: ${parseError.message}`
      };
    }
  } catch (error) {
    console.error('Error in compareMasterpieceWithReferences:', {
      error: error.message,
      stack: error.stack,
      citationStyle: citationStyle
    });
    // Rethrow with more context
    throw new Error(`Failed to compare documents using ${citationStyle} style: ${error.message}`);
  }
}
