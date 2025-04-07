'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useState, useEffect } from 'react'

// Custom component that accepts text content and uncited lines
const Tiptap = ({ content = '', uncitedLines = [] }) => {
  // Parse the content if it's provided as a string
  const initialContent = content ? content : '<p>Hello World! 🌎️</p>'
  
  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent,
    editable: false, // Make it read-only since we're using it for display
  })

  // Apply highlighting to uncited lines when the editor is ready
  useEffect(() => {
    if (editor && uncitedLines.length > 0) {
      // Get the editor's document
      const { state, view } = editor
      
      // Function to apply highlighting
      const highlightUncitedLines = () => {
        // We need to operate within a transaction to modify the document
        editor.commands.setContent(initialContent)
        
        // For demonstration purposes, let's highlight by adding a span with a background color
        // In a real implementation, this would be more sophisticated
        const doc = editor.getHTML()
        const lines = doc.split('</p><p>')
        
        const highlightedLines = lines.map((line, index) => {
          // Check if this line should be highlighted
          if (uncitedLines.includes(index)) {
            return line.replace(/<p>(.*)<\/p>/, '<p><span style="background-color: yellow;">$1</span></p>')
          }
          return line
        })
        
        // Set the highlighted content
        const newContent = highlightedLines.join('</p><p>')
        editor.commands.setContent(newContent)
      }
      
      highlightUncitedLines()
    }
  }, [editor, uncitedLines, initialContent])

  return (
    <div className="citation-editor">
      <EditorContent editor={editor} />
      {uncitedLines.length > 0 && (
        <div className="mt-2 text-sm text-amber-600">
          The highlighted text may need citations.
        </div>
      )}
    </div>
  )
}

export default Tiptap 