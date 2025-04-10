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
        toolbar: false,
        content_style: 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 14px; }',
        toolbar_sticky: true,
        toolbar_sticky_offset: 0,
        toolbar_mode: 'sliding',
        setup: (editor: any) => {
          editor.on('focus', () => {
            editor.execCommand('mceToggleEditor', false, editor);
          });
        }
      }}
      disabled={readOnly}
      onEditorChange={(content) => {
        onChange(content);
      }}
    />
  );
};

export default RichTextEditor; 