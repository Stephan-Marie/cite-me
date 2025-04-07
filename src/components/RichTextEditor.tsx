import { Editor } from '@tinymce/tinymce-react';
import { useRef } from 'react';

interface RichTextEditorProps {
  initialValue?: string;
  onChange: (content: string) => void;
  height?: number;
  readOnly?: boolean;
}

const RichTextEditor = ({ 
  initialValue = '', 
  onChange, 
  height = 300,
  readOnly = false
}: RichTextEditorProps) => {
  const editorRef = useRef<any>(null);

  return (
    <Editor
      apiKey={process.env.NEXT_PUBLIC_TINYMCE_API_KEY}
      onInit={(evt, editor) => editorRef.current = editor}
      initialValue={initialValue}
      init={{
        height,
        menubar: false,
        plugins: [
          'advlist', 'autolink', 'lists', 'link', 'charmap', 'preview',
          'searchreplace', 'visualblocks', 'code', 'fullscreen',
          'insertdatetime', 'table', 'wordcount'
        ],
        toolbar: 'undo redo | formatselect | ' +
          'bold italic | alignleft aligncenter ' +
          'alignright alignjustify | bullist numlist outdent indent | ' +
          'removeformat',
        content_style: 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 14px; }',
      }}
      disabled={readOnly}
      onEditorChange={(content) => {
        onChange(content);
      }}
    />
  );
};

export default RichTextEditor; 