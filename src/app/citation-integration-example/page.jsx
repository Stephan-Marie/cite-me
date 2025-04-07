'use client'

import Tiptap from '../../components/Tiptap'
import { useState } from 'react'

export default function CitationIntegrationExample() {
  // This would be the result from your citation analysis
  const [analysisResult, setAnalysisResult] = useState({
    content: `<p>In Smith v. Jones (2018), the court held that parties must disclose all relevant documents.</p>
<p>The doctrine of promissory estoppel prevents a party from denying the truth of a statement that another party has relied on.</p>
<p>According to the Supreme Court decision in Brown v. Board of Education (1954), segregation in public schools is unconstitutional.</p>
<p>Contract law requires consideration for a valid contract to be formed.</p>
<p>In Donoghue v. Stevenson [1932] AC 562, Lord Atkin established the "neighbour principle" in negligence law.</p>`,
    uncitedLines: [1, 3], // The AI has determined that lines 1 and 3 lack proper citations
    citations: [
      { source: "Smith v. Jones [2018] UKSC 12", page: "p.45" },
      { source: "Brown v. Board of Education, 347 U.S. 483 (1954)", page: "p.495" },
      { source: "Donoghue v. Stevenson [1932] AC 562", page: "p.580" }
    ]
  })

  return (
    <div className="max-w-6xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Citation Analysis Results</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Document Text</h2>
          <p className="text-sm text-gray-500 mb-4">Paragraphs highlighted in yellow may need citations</p>
          <div className="border rounded-lg p-4">
            <Tiptap 
              content={analysisResult.content} 
              uncitedLines={analysisResult.uncitedLines} 
            />
          </div>
        </div>
        
        <div className="bg-gray-50 p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Citations Found</h2>
          <ul className="space-y-3">
            {analysisResult.citations.map((citation, index) => (
              <li key={index} className="p-3 bg-white rounded border">
                <p className="font-semibold">{citation.source}</p>
                <p className="text-sm text-gray-600">Page: {citation.page}</p>
              </li>
            ))}
          </ul>
          
          <div className="mt-6">
            <h3 className="font-semibold text-amber-700 mb-2">Citation Suggestions</h3>
            <p className="text-sm">The highlighted sections may need additional citations. Consider adding references for:</p>
            <ul className="list-disc ml-5 mt-2 text-sm">
              <li>The doctrine of promissory estoppel</li>
              <li>Basic principles of contract law</li>
            </ul>
          </div>
        </div>
      </div>
      
      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold text-blue-700">How to implement in your application</h3>
        <p className="mt-2">
          When your AI model analyzes text for citations, have it return an object containing:
          <ol className="list-decimal ml-6 mt-2 space-y-1">
            <li>The full text content (with paragraph tags)</li>
            <li>An array of line indices that lack proper citations</li>
            <li>The list of citations found</li>
          </ol>
        </p>
        <p className="mt-2">
          Then pass the content and uncitedLines to the Tiptap component to display the highlighted text.
        </p>
      </div>
    </div>
  )
} 