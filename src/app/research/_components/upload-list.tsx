'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ResearchUpload } from '@/lib/types'
import { UploadForm } from './upload-form'

function formatBytes(bytes: number | null) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function UploadList() {
  const [uploads, setUploads] = useState<ResearchUpload[]>([])
  const [loading, setLoading] = useState(true)

  const fetchUploads = useCallback(async () => {
    try {
      const res = await fetch('/api/research/uploads')
      if (res.ok) {
        const data = await res.json()
        setUploads(data)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUploads() }, [fetchUploads])

  return (
    <div className="space-y-6">
      <UploadForm onUploadComplete={fetchUploads} />

      <div>
        <h2 className="mb-3 text-lg font-semibold">Upload History</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : uploads.length === 0 ? (
          <p className="text-sm text-muted-foreground">No uploads yet. Upload a WhatsApp chat export to get started.</p>
        ) : (
          <div className="divide-y rounded-lg border">
            {uploads.map((upload) => (
              <div key={upload.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{upload.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(upload.file_size_bytes)} — {formatDate(upload.created_at)}
                  </p>
                </div>
                <span className="ml-4 shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {upload.upload_type.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
