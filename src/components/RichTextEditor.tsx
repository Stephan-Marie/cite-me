'use client';

import React, { useState, useRef } from 'react';
import { Editor } from '@tinymce/tinymce-react';

interface RichTextEditorProps {
  initialValue: string;
  onSave?: (content: string) => void;
  readOnly?: boolean;
  height?: number | string;
  placeholder?: string;
  className?: string;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  initialValue,
  onSave,
  readOnly = true,
  height = 300,
  placeholder = 'No content',
  className = ''
}) => {
  // Always start in view mode (not editing), even if readOnly is false
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const editorRef = useRef<any>(null);
  const [isFocused, setIsFocused] = useState(false);

  const handleSave = () => {
    if (editorRef.current) {
      const content = editorRef.current.getContent();
      setValue(content);
      if (onSave) {
        onSave(content);
      }
      setIsEditing(false);
    }
  };

  return (
    <div className={`rich-text-editor ${className}`}>
      {!isEditing ? (
        <div className="relative">
          <div 
            className="prose max-w-none p-3 bg-white rounded-md shadow-sm"
            dangerouslySetInnerHTML={{ __html: value || placeholder }}
          />
          {!readOnly && (
            <button
              onClick={() => setIsEditing(true)}
              className="absolute top-2 right-2 p-2 text-blue-600 hover:text-blue-800 bg-white rounded-full hover:bg-blue-50 shadow-sm"
              title="Edit"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
        </div>
      ) : (
        <div className={`border ${isFocused ? 'border-blue-300 ring-1 ring-blue-200' : 'border-gray-300'} rounded-md transition-all duration-200`}>
          <Editor
            apiKey={process.env.NEXT_PUBLIC_TINYMCE_API_KEY || ''}
            onInit={(evt, editor) => {
              editorRef.current = editor;
              // Add focus listeners
              editor.on('focus', () => setIsFocused(true));
              editor.on('blur', () => setIsFocused(false));
            }}
            initialValue={value}
            init={{
              height,
              menubar: false,
              plugins: [
                'autoresize', 'autolink', 'link', 
                'lists', 'quickbars', 'wordcount', 'annotation'
              ],
              toolbar: false,
              inline: false,
              quickbars_selection_toolbar: 'bold italic | formatselect | bullist numlist | link blockquote',
              quickbars_insert_toolbar: false,
              contextmenu: false,
              skin: 'oxide',
              content_css: 'default',
              content_style: `
                body { 
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                  font-size: 16px;
                  line-height: 1.6;
                  color: #333;
                  padding: 15px;
                  max-width: 100%;
                  margin: 0 auto;
                  outline: none;
                }
                p { margin-bottom: 1em; }
                h1, h2, h3, h4, h5, h6 { font-weight: 600; margin-top: 1.5em; margin-bottom: 0.5em; }
                a { color: #4361ee; text-decoration: none; }
                blockquote { 
                  border-left: 3px solid #e9e9e9; 
                  padding-left: 1em; 
                  margin-left: 1em;
                  font-style: italic;
                  color: #555;
                }
                em { font-style: italic; }
                strong { font-weight: bold; }
                ul, ol { padding-left: 2em; margin-bottom: 1em; }
                ul > li { list-style: disc; }
                ol > li { list-style: decimal; }
                
                /* Annotation highlight styles */
                .mce-annotation {
                  background-color: #fff8c5 !important;
                  border-bottom: 1px solid #f0c808;
                  position: relative;
                }
                
                /* Citation highlight specific styles */
                .mce-annotation[data-mce-annotation="citation"] {
                  display: inline;
                  padding: 0 1px;
                  border-radius: 2px;
                }
                
                /* Improved focus styling for highlighted text */
                .mce-annotation:hover {
                  background-color: #ffe066 !important;
                }
                
                /* Focus state styling */
                body.mce-content-body:focus {
                  box-shadow: none;
                  outline: none;
                }
                
                /* TinyMCE UI customizations */
                .tox-editor-header {
                  background-color: transparent !important;
                }
                .tox-toolbar__primary {
                  background-color: transparent !important;
                }
                .tox-toolbar-overlord {
                  background-color: transparent !important;
                }
                .tox-toolbar__group {
                  border: none !important;
                }
                .tox-collection__item-label {
                  line-height: 1.4 !important;
                }
                .tox .tox-collection--list .tox-collection__item--active {
                  background-color: #f1f5f9 !important;
                }
                .tox .tox-tbtn--enabled, .tox .tox-tbtn--enabled:hover {
                  background-color: #f1f5f9 !important;
                }
              `,
              formats: {
                // Add custom formats that can be selected from formatselect dropdown
                h3: { block: 'h3', styles: { 'font-weight': 'bold', 'margin-top': '1em' } },
                h4: { block: 'h4' },
                p: { block: 'p', styles: { 'margin-bottom': '1em' } },
              },
              // Set up annotation support
              setup: (editor) => {
                // Register the annotation plugin
                editor.on('init', () => {
                  if (editor.getContent() === '') {
                    const placeholderText = placeholder || 'Start typing...';
                    const placeholderEl = editor.getBody().getAttribute('data-placeholder');
                    
                    if (!placeholderEl) {
                      editor.getBody().setAttribute('data-placeholder', placeholderText);
                    }
                  }
                  
                  // Preserve annotations
                  editor.serializer.addNodeFilter('span', function(nodes) {
                    for (let i = 0; i < nodes.length; i++) {
                      const node = nodes[i];
                      const hasAttr = node && typeof node.attr === 'function';
                      const className = hasAttr ? node.attr('class') : null;
                      
                      if (hasAttr && className && 
                          typeof className === 'string' && 
                          className.indexOf('mce-annotation') !== -1) {
                        if (hasAttr) {
                          node.attr('data-mce-annotation', 'citation');
                          node.attr('data-mce-annotation-uid', 'citation-highlight');
                        }
                      }
                    }
                  });
                });
                
                // Add custom button for creating highlights if needed
                editor.ui.registry.addToggleButton('highlight', {
                  icon: 'highlight-bg-color',
                  tooltip: 'Highlight as citation',
                  onAction: function() {
                    editor.annotator.annotate('citation', {
                      uid: 'citation-highlight'
                    });
                    editor.focus();
                  },
                  onSetup: function(api) {
                    // Check if selection is within an annotation
                    const checkForAnnotation = () => {
                      try {
                        const selected = editor.selection.getNode();
                        // Find annotation in parents
                        let current = selected;
                        let hasAnnotation = false;
                        
                        // Safely check parent nodes for annotation classes
                        while (current && current.nodeType === 1 && current !== editor.getBody()) {
                          if (current.classList && current.classList.contains('mce-annotation')) {
                            hasAnnotation = true;
                            break;
                          }
                          current = current.parentNode as HTMLElement;
                        }
                        
                        api.setActive(hasAnnotation);
                      } catch (e) {
                        api.setActive(false);
                      }
                    };
                    
                    // Listen for selection changes
                    editor.on('NodeChange', checkForAnnotation);
                    
                    return function() {
                      editor.off('NodeChange', checkForAnnotation);
                    };
                  }
                });
              },
              // Annotations settings
              annotations_default_class: 'mce-annotation',
              annotations_selector: '.mce-annotation',
              annotations_prepend_class: true,
              autoresize_bottom_margin: 20,
              placeholder: placeholder,
              branding: false,
              promotion: false,
              statusbar: false,
              resize: false,
              elementpath: false,
              // Make the toolbar float in a small bubble when text is selected
              fixed_toolbar_container: 'tinymce-toolbar',
              // Disable browser's native spell checker to avoid double checking
              browser_spellcheck: true,
            }}
          />
          <div className="flex justify-end p-2 bg-gray-50 border-t">
            <button
              onClick={() => setIsEditing(false)}
              className="px-3 py-1 mr-2 text-sm text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-1 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RichTextEditor; 