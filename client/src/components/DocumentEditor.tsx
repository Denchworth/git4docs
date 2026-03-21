/**
 * TipTap-based document editor.
 * Stores markdown under the hood but presents rich text to users.
 */

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { useEffect } from 'react';

interface DocumentEditorProps {
  content: string;
  onChange?: (content: string) => void;
  editable?: boolean;
}

function ToolbarButton({
  onClick,
  active,
  children,
  title,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`px-2 py-1 text-sm rounded transition-colors ${
        active
          ? 'bg-blue-100 text-blue-600'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
      }`}
    >
      {children}
    </button>
  );
}

export default function DocumentEditor({ content, onChange, editable = true }: DocumentEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Highlight,
      Typography,
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      Link.configure({
        openOnClick: true,
        autolink: false,
        HTMLAttributes: {
          class: 'text-blue-500 underline hover:text-blue-700',
        },
      }),
      Placeholder.configure({
        placeholder: 'Start writing your document...',
      }),
    ],
    content: markdownToHtml(content),
    editable,
    onUpdate: ({ editor }) => {
      if (onChange) {
        onChange(htmlToMarkdown(editor.getHTML()));
      }
    },
  });

  useEffect(() => {
    if (editor && content) {
      const currentHtml = editor.getHTML();
      const newHtml = markdownToHtml(content);
      // Only update if content actually changed (avoid cursor jump)
      if (currentHtml !== newHtml && !editor.isFocused) {
        editor.commands.setContent(newHtml);
      }
    }
  }, [content, editor]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editable, editor]);

  if (!editor) return null;

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:text-slate-500 [&_td]:border [&_td]:border-slate-200 [&_td]:px-3 [&_td]:py-2 [&_td]:text-sm">
      {editable && (
        <div className="border-b border-slate-200 px-2 py-1 flex gap-0.5 flex-wrap bg-slate-50">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            active={editor.isActive('heading', { level: 1 })}
            title="Heading 1"
          >
            H1
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive('heading', { level: 2 })}
            title="Heading 2"
          >
            H2
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive('heading', { level: 3 })}
            title="Heading 3"
          >
            H3
          </ToolbarButton>
          <div className="w-px bg-slate-300 mx-1" />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive('bold')}
            title="Bold"
          >
            <strong>B</strong>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive('italic')}
            title="Italic"
          >
            <em>I</em>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={editor.isActive('underline')}
            title="Underline"
          >
            <u>U</u>
          </ToolbarButton>
          <div className="w-px bg-slate-300 mx-1" />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive('bulletList')}
            title="Bullet List"
          >
            &bull; List
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive('orderedList')}
            title="Numbered List"
          >
            1. List
          </ToolbarButton>
          <div className="w-px bg-slate-300 mx-1" />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive('blockquote')}
            title="Quote"
          >
            &ldquo; Quote
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="Horizontal Rule"
          >
            &#8213;
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            active={editor.isActive('highlight')}
            title="Highlight"
          >
            Highlight
          </ToolbarButton>
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}

/**
 * Simple markdown → HTML conversion for TipTap.
 * Handles basic markdown syntax. For production, use a proper parser.
 */
function markdownToHtml(md: string): string {
  if (!md) return '<p></p>';

  // Extract HTML tables before splitting (they span multiple lines)
  const htmlTables: string[] = [];
  let preprocessed = md.replace(/<table[\s\S]*?<\/table>/gi, (match) => {
    htmlTables.push(match);
    return `%%HTMLTABLE_${htmlTables.length - 1}%%`;
  });

  // Extract HTML comments
  preprocessed = preprocessed.replace(/<!--[\s\S]*?-->/g, '');

  // Normalize: ensure headings are always their own block
  const normalized = preprocessed.replace(/^(#{1,3} .+)\n(?!#|\n)/gm, '$1\n\n');

  return normalized
    .split('\n\n')
    .map((block) => {
      block = block.trim();
      if (!block) return '<p></p>';

      // Headings — only take the first line
      const headingMatch = block.match(/^(#{1,3}) (.+?)$/m);
      if (headingMatch && block.startsWith('#')) {
        const level = headingMatch[1].length;
        const text = headingMatch[2];
        const tag = `h${level}`;
        return `<${tag}>${inline(text)}</${tag}>`;
      }

      // HTML table placeholders — restore original tables
      const tableMatch = block.match(/^%%HTMLTABLE_(\d+)%%$/);
      if (tableMatch) return htmlTables[parseInt(tableMatch[1])];

      // HTML comments — skip
      if (block.match(/^\s*<!--/)) return '';

      // Horizontal rule
      if (block === '---' || block === '***') return '<hr>';

      // Unordered list
      if (block.match(/^[-*] /m)) {
        const items = block.split('\n').filter(l => l.match(/^[-*] /));
        return `<ul>${items.map(i => `<li>${inline(i.replace(/^[-*] /, ''))}</li>`).join('')}</ul>`;
      }

      // Ordered list
      if (block.match(/^\d+\. /m)) {
        const items = block.split('\n').filter(l => l.match(/^\d+\. /));
        return `<ol>${items.map(i => `<li>${inline(i.replace(/^\d+\. /, ''))}</li>`).join('')}</ol>`;
      }

      // Blockquote
      if (block.startsWith('> ')) {
        return `<blockquote><p>${inline(block.replace(/^> ?/gm, ''))}</p></blockquote>`;
      }

      // Regular paragraph
      return `<p>${inline(block.replace(/\n/g, '<br>'))}</p>`;
    })
    .filter(Boolean)
    .join('');
}

function inline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    // Markdown links: [text](url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, linkText, url) => {
      const resolved = resolvePolicportUrl(url);
      return `<a href="${resolved}">${linkText}</a>`;
    });
}

/**
 * Resolve git4docs:// URLs to in-app routes.
 * git4docs://DOC_ID?rev=N → /document/CATEGORY/DOC_ID.md
 * Falls back to # if we can't determine the category (client-side
 * doesn't have the index, so we infer category from the doc ID prefix).
 */
function resolvePolicportUrl(url: string): string {
  if (!url.startsWith('git4docs://')) return url;

  const rest = url.slice('git4docs://'.length);
  const [docId] = rest.split('?');
  // Infer category from doc ID prefix: POL-001-xxx → POL
  const prefixMatch = docId.match(/^([A-Z]+)-/);
  if (prefixMatch) {
    return `/document/${prefixMatch[1]}/${docId}.md`;
  }
  return `/document/${docId}`;
}

/**
 * Simple HTML → Markdown conversion.
 * Extracts text content and basic formatting.
 */
function htmlToMarkdown(html: string): string {
  // Preserve HTML tables as-is (extract them first, replace with placeholders, restore after)
  const tables: string[] = [];
  let processed = html.replace(/<table[\s\S]*?<\/table>/gi, (match) => {
    tables.push(match);
    return `\n\n%%TABLE_${tables.length - 1}%%\n\n`;
  });

  processed = processed
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<a[^>]+href="([^"]*)"[^>]*>(.*?)<\/a>/gi, (_m, href, text) => {
      // Convert in-app document URLs back to git4docs:// scheme
      const docMatch = href.match(/^\/document\/([A-Z]+)\/([^.]+)\.md$/);
      if (docMatch) {
        return `[${text}](git4docs://${docMatch[2]})`;
      }
      return `[${text}](${href})`;
    })
    .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<em>(.*?)<\/em>/gi, '*$1*')
    .replace(/<u>(.*?)<\/u>/gi, '$1')
    .replace(/<code>(.*?)<\/code>/gi, '`$1`')
    .replace(/<blockquote[^>]*><p>(.*?)<\/p><\/blockquote>/gi, '> $1\n\n')
    .replace(/<hr\s*\/?>/gi, '---\n\n')
    .replace(/<ul>([\s\S]*?)<\/ul>/gi, (_, items) => {
      const result: string[] = [];
      const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      let m;
      while ((m = liRegex.exec(items)) !== null) {
        const text = m[1].replace(/<\/?p[^>]*>/gi, '').trim();
        result.push(`- ${text}`);
      }
      return result.join('\n') + '\n\n';
    })
    .replace(/<ol>([\s\S]*?)<\/ol>/gi, (_, items) => {
      const result: string[] = [];
      const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      let m;
      let i = 0;
      while ((m = liRegex.exec(items)) !== null) {
        const text = m[1].replace(/<\/?p[^>]*>/gi, '').trim();
        result.push(`${++i}. ${text}`);
      }
      return result.join('\n') + '\n\n';
    })
    .replace(/<p>(.*?)<\/p>/gi, '$1\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Restore HTML tables
  for (let i = 0; i < tables.length; i++) {
    processed = processed.replace(`%%TABLE_${i}%%`, '\n\n' + tables[i] + '\n\n');
  }

  return processed.replace(/\n{3,}/g, '\n\n').trim();
}
