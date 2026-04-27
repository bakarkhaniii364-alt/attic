import React, { useEffect, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'
import { RetroWindow } from '../components/UI.jsx'

export function SharedNotes({ onClose, sfx, roomName, userName, userColor }) {
  const [provider, setProvider] = useState(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: false }),
      Collaboration.configure({
        document: new Y.Doc(),
      }),
      CollaborationCursor.configure({
        provider: provider,
        user: { name: userName, color: userColor || '#e94560' },
      }),
    ],
  })

  useEffect(() => {
    if (!editor) return;

    const ydoc = editor.extensionManager.extensions.find(e => e.name === 'collaboration').options.document;
    const webrtcProvider = new WebrtcProvider(`attic-notes-${roomName}`, ydoc);
    
    setProvider(webrtcProvider);

    return () => {
      webrtcProvider.destroy();
    }
  }, [editor, roomName])

  if (!editor) return null;

  return (
    <RetroWindow title="shared_notes.exe" onClose={onClose} sfx={sfx} className="w-full max-w-2xl h-[calc(100dvh-4rem)] max-h-[800px]" noPadding>
      <div className="flex flex-col h-full bg-white">
        <div className="p-3 border-b-2 border-dashed border-[var(--border)] bg-[var(--bg-window)] flex items-center justify-between">
           <h2 className="font-black text-xs uppercase tracking-widest">Shared Notepad</h2>
           <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse shadow-[0_0_5px_#22c55e]" title="Live Syncing" />
           </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 prose prose-sm font-mono focus:outline-none selection:bg-[var(--accent)] selection:text-[var(--text-main)]">
          <EditorContent editor={editor} className="outline-none" />
        </div>

        <div className="p-2 bg-[var(--bg-window)] border-t border-dashed border-[var(--border)]/20 text-[8px] font-black uppercase tracking-[0.2em] text-center opacity-40">
           Real-time CRDT Collaboration Active
        </div>
      </div>
    </RetroWindow>
  )
}
