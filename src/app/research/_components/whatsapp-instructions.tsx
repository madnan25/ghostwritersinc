'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

export function WhatsAppInstructions() {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-lg border border-border bg-card text-card-foreground">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-accent/50 transition-colors rounded-lg"
      >
        <span>How to export a WhatsApp chat</span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="border-t border-border px-4 py-4 text-sm text-muted-foreground space-y-4">
          <ol className="list-decimal list-inside space-y-2">
            <li>Open WhatsApp on your phone.</li>
            <li>Go to the chat you want to export.</li>
            <li>
              <span className="font-medium text-foreground">Android:</span> Tap the 3-dot menu → More → Export Chat.{' '}
              <span className="font-medium text-foreground">iOS:</span> Tap the contact/group name → Export Chat.
            </li>
            <li>Choose <span className="font-medium text-foreground">Without Media</span> for a text-only export.</li>
            <li>Save or share the <code className="text-xs bg-muted rounded px-1 py-0.5">.txt</code> file to your computer.</li>
            <li>Upload the file on this page using the form below.</li>
          </ol>

          <p className="text-xs">
            Both <code className="bg-muted rounded px-1 py-0.5">.txt</code> and{' '}
            <code className="bg-muted rounded px-1 py-0.5">.zip</code> files are accepted — WhatsApp sometimes wraps the export in a zip archive.
          </p>

          <p className="text-xs border-t border-border pt-3">
            Uploaded files are stored securely and used for content mining and research by your team.
          </p>
        </div>
      )}
    </div>
  )
}
