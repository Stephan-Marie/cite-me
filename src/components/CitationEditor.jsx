'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect } from 'react'

const CitationEditor = ({ content, readOnly = true }) => {
  const editor = useEditor({
    extensions: [StarterKit],
    content: content || '<p>No content to display</p>',
    editable: !readOnly,
  })

  // Update content when it changes externally
  useEffect(() => {
    if (editor && content) {
      editor.commands.setContent(content)
    }
  }, [editor, content])

  return (
    <div className="citation-editor">
      <style jsx global>{`
        .citation-editor .ProseMirror {
          padding: 1rem;
          border-radius: 0.375rem;
          min-height: 150px;
          outline: none;
          background-color: white;
        }
        
        .citation-editor .ProseMirror p {
          margin-bottom: 0.75rem;
        }
        
        .citation-editor .uncited-text {
          background-color: #FFEB3B;
          padding: 0 2px;
          border-radius: 2px;
        }
      `}</style>
      <EditorContent editor={editor} />
    </div>
  )
}

export default CitationEditor 