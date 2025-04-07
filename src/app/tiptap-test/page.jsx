'use client'

import Tiptap from '../../components/Tiptap'
import { useState } from 'react'

export default function TiptapTestPage() {
  // Sample text with multiple paragraphs
  const sampleText = `<p>This is the first paragraph of the document. It contains some information that might need a citation.</p>
<p>The second paragraph discusses a different topic and includes factual statements that should be cited.</p>
<p>Here in the third paragraph, we have properly cited information with a reference [1].</p>
<p>The fourth paragraph makes claims without any supporting evidence or citations.</p>
<p>Finally, the fifth paragraph includes another properly cited statement [2].</p>`

  // Indicate which lines (0-indexed) are missing citations
  const uncitedLines = [0, 1, 3]

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Citation Highlighting Demo</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Document Text with Uncited Passages Highlighted</h2>
        <Tiptap content={sampleText} uncitedLines={uncitedLines} />
      </div>
      
      <div className="mt-8 bg-gray-50 p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">How This Works</h2>
        <p className="mb-2">The AI model identifies lines that appear to be making claims without proper citations.</p>
        <p className="mb-2">These lines are highlighted in yellow to indicate that they may need citations.</p>
        <p className="mb-2">In this example, lines 1, 2, and 4 are marked as uncited.</p>
      </div>
    </div>
  )
} 