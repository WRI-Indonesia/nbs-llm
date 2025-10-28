'use client'

import React, { useCallback, useMemo, useState } from 'react'
import useSWR, { mutate } from 'swr'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogPortal } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableCell, TableHead } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Upload, Trash2, RefreshCw, File, Loader2, Search, FolderOpen, X, Database, PlayCircle, Settings, FileText, AlertCircle } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { Label } from '@/components/ui/label'

// --------------------
// Types
// --------------------
interface FileItem {
  name: string
  size: number
  lastModified: string
  etag: string
}

interface LogEntry {
  id: string
  level: string
  message: string
  timestamp: string
}

interface MinioStorageModalProps {
  isOpen: boolean
  onClose: () => void
}

// --------------------
// Fetcher for useSWR
// --------------------
const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    const err = new Error(error?.error || 'Failed to fetch') as any
    err.info = error
    throw err
  }
  return res.json()
}

// --------------------
// Small UI helpers
// --------------------
const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

const getFileName = (fullPath: string) => fullPath.split('/').pop() || fullPath

const getLogIcon = (level: string) => {
  switch (level) {
    case 'error':
      return <AlertCircle className="h-4 w-4 text-red-500" />
    case 'warn':
      return <AlertCircle className="h-4 w-4 text-yellow-500" />
    case 'info':
      return <FileText className="h-4 w-4 text-blue-500" />
    default:
      return <FileText className="h-4 w-4 text-gray-500" />
  }
}

const getLogBadgeColor = (level: string) => {
  switch (level) {
    case 'error':
      return 'bg-red-100 text-red-800 border-red-300'
    case 'warn':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300'
    case 'info':
      return 'bg-blue-100 text-blue-800 border-blue-300'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300'
  }
}

// --------------------
// Files Tab (separated)
// --------------------
function FilesTab({
  files,
  isLoading,
  mutateFiles,
  jobStatus,
}: {
  files: FileItem[] | undefined
  isLoading: boolean
  mutateFiles: () => void
  jobStatus: any
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [indexing, setIndexing] = useState(false)

  const filteredFiles = useMemo(() => {
    if (!files) return []
    if (!searchTerm.trim()) return files
    const q = searchTerm.toLowerCase()
    return files.filter(f => getFileName(f.name).toLowerCase().includes(q))
  }, [files, searchTerm])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') {
      toast.error('Please select a PDF')
      e.target.value = ''
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/storage', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Upload failed')
      toast.success('Uploaded')
      mutateFiles()
    } catch (err) {
      console.error(err)
      toast.error((err as Error).message || 'Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleDelete = async (fileName: string) => {
    if (!confirm(`Delete "${fileName}"?`)) return
    setDeleting(fileName)
    try {
      const res = await fetch(`/api/storage?fileName=${encodeURIComponent(fileName)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      toast.success('Deleted')
      mutateFiles()
    } catch (err) {
      console.error(err)
      toast.error((err as Error).message || 'Delete failed')
    } finally {
      setDeleting(null)
    }
  }

  const handleIndex = async () => {
    setIndexing(true)
    try {
      const res = await fetch('/api/storage/index')
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to index')
      }
      await res.json()
      toast.success('Index job queued')
      // Revalidate job status
      mutate('/api/storage/index/status')
    } catch (err) {
      console.error(err)
      toast.error((err as Error).message || 'Failed to index')
    } finally {
      setIndexing(false)
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center justify-between gap-4 mb-4">
        <form className="flex items-center gap-2 flex-1 max-w-xl" onSubmit={(e) => e.preventDefault()}>
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search files..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 pr-8" />
            {searchTerm && (
              <button type="button" onClick={() => setSearchTerm('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted"><X className="h-4 w-4 text-muted-foreground" /></button>
            )}
          </div>
        </form>

        <div className="flex items-center gap-2">
          <input type="file" id="file-upload" className="hidden" accept=".pdf,application/pdf" onChange={handleUpload} disabled={uploading} />
          <label htmlFor="file-upload">
            <Button variant="outline" disabled={uploading} asChild>
              <span>{uploading ? <Spinner className="w-4 h-4 mr-2" /> : <Upload className="w-4 h-4 mr-2" />}{uploading ? 'Uploading...' : 'Upload PDF'}</span>
            </Button>
          </label>

          <Button variant="default" onClick={jobStatus?.status === 'paused' ? () => mutate('/api/storage/index/control?jobId=' + jobStatus.id + '&action=resume') : handleIndex} disabled={indexing || uploading || isLoading}>
            {jobStatus?.status === 'paused' ? (<><PlayCircle className="w-4 h-4 mr-2" />Resume</>) : (indexing || jobStatus?.status === 'processing') ? (<><Spinner className="w-4 h-4 mr-2" />Processing...</>) : (<><Database className="w-4 h-4 mr-2" />Index Files</>)}
          </Button>

          <Button variant="outline" onClick={() => mutateFiles()} disabled={isLoading}>
            {isLoading ? <Spinner className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto border rounded-lg min-h-0">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64"><Spinner className="w-8 h-8" /><p className="mt-4 text-sm text-muted-foreground">Loading files...</p></div>
        ) : (!files || filteredFiles.length === 0) ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <File className="h-12 w-12 mb-4 text-muted-foreground/50" />
            <p className="text-lg font-medium">{searchTerm ? 'No files found' : 'No files'}</p>
            <p className="text-sm">{searchTerm ? 'Try adjusting your search' : 'Upload a file to get started'}</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="w-12">Icon</TableHead>
                <TableHead>File Name</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Last Modified</TableHead>
                <TableHead className="text-right w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFiles.map(file => (
                <TableRow key={file.name} className="hover:bg-slate-50/30">
                  <TableCell><div className='flex items-center justify-center'><File className="w-4 h-4 text-blue-600" /></div></TableCell>
                  <TableCell className="font-medium max-w-[300px] truncate">{getFileName(file.name)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatFileSize(file.size)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{file.lastModified ? new Date(file.lastModified).toLocaleDateString() : 'N/A'}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(file.name)} disabled={deleting === file.name}>{deleting === file.name ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 text-red-500" />}</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 border-t flex-shrink-0 text-sm text-muted-foreground">
        <span>{(files || []).length} {(files || []).length === 1 ? 'file' : 'files'}{searchTerm && ` (filtered from ${(files || []).length})`}</span>
      </div>
    </div>
  )
}

// --------------------
// Config Tab (separated)
// --------------------
function ConfigTab({ chunkSize, overlap, setChunkSize, setOverlap }: any) {
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chunkSize, overlap }) })
      if (!res.ok) throw new Error('Failed to save')
      await res.json()
      toast.success('Configuration saved')
      // revalidate server config
      mutate('/api/config')
    } catch (err) {
      console.error(err)
      toast.error((err as Error).message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border rounded-lg p-6 bg-slate-50/50">
      <h3 className="text-lg font-semibold mb-4">Chunking Configuration</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex flex-col gap-3">
          <Label htmlFor="chunkSize">Chunk size (characters)</Label>
          <input id="chunkSize" type="range" min={200} max={8000} step={100} value={chunkSize} onChange={(e) => setChunkSize(parseInt(e.target.value))} />
          <div className="text-sm text-muted-foreground">Current: <span className="font-medium">{chunkSize} characters</span></div>
          <p className="text-xs text-muted-foreground">The size of text chunks to split documents into. Larger chunks capture more context but may lose fine-grained details.</p>
        </div>
        <div className="flex flex-col gap-3">
          <Label htmlFor="overlap">Overlap (characters)</Label>
          <input id="overlap" type="range" min={0} max={Math.max(0, Math.min(chunkSize - 1, 4000))} step={50} value={overlap} onChange={(e) => setOverlap(parseInt(e.target.value))} />
          <div className="text-sm text-muted-foreground">Current: <span className="font-medium">{overlap} characters</span></div>
          <p className="text-xs text-muted-foreground">The number of characters to overlap between consecutive chunks. Helps maintain context across chunk boundaries.</p>
        </div>
      </div>
      <div className="mt-6 flex justify-end">
        <Button onClick={handleSave} disabled={saving}>{saving ? <Spinner className="w-4 h-4 mr-2" /> : <Settings className="w-4 h-4 mr-2" />}{saving ? 'Saving...' : 'Save Configuration'}</Button>
      </div>
    </div>
  )
}

// --------------------
// Logs Tab
// --------------------
function LogsTab({ jobStatus }: { jobStatus: any }) {
  // useSWR with dynamic key and refresh while logs tab is active
  const { data, isValidating } = useSWR(
    () => (jobStatus?.id ? `/api/storage/index/logs?jobId=${jobStatus.id}` : null),
    fetcher,
    { refreshInterval: jobStatus?.id ? 10000 : 0 }
  )

  const logs: LogEntry[] = data?.logs || []

  if (!jobStatus) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <FileText className="h-12 w-12 mb-4 text-muted-foreground/50" />
        <p className="text-lg font-medium">No indexing job found</p>
        <p className="text-sm">Start an indexing job to see logs</p>
      </div>
    )
  }

  if (isValidating && logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64"><Spinner className="w-8 h-8" /><p className="mt-4 text-sm text-muted-foreground">Loading logs...</p></div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <FileText className="h-12 w-12 mb-4 text-muted-foreground/50" />
        <p className="text-lg font-medium">No logs available</p>
        <p className="text-sm">Logs will appear here when indexing starts</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto border rounded-lg min-h-0 bg-slate-50">
      <div className="p-4 space-y-2">
        {logs.map((log) => (
          <div key={log.id} className="flex items-start gap-3 p-3 bg-white rounded border hover:bg-slate-50 transition-colors">
            <div className="flex-shrink-0 mt-0.5">{getLogIcon(log.level)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs px-2 py-0.5 rounded border ${getLogBadgeColor(log.level)}`}>{log.level.toUpperCase()}</span>
                <span className="text-xs text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</span>
              </div>
              <p className="text-sm break-words">{log.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// --------------------
// Job Progress Component
// --------------------
function JobProgress({ jobStatus }: { jobStatus: any }) {
  if (!jobStatus) return null
  if (!['pending', 'processing', 'paused'].includes(jobStatus.status)) return null

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex-shrink-0 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-blue-900">{jobStatus.status === 'paused' ? 'Indexing paused' : 'Indexing in progress...'}</span>
        </div>
        <span className="text-sm text-blue-700">{jobStatus.processedFiles || 0} of {jobStatus.totalFiles || 0} files</span>
      </div>

      {jobStatus.totalFiles > 0 && (
        <div className="w-full bg-blue-200 rounded-full h-2 mb-2">
          <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${((jobStatus.processedFiles || 0) / jobStatus.totalFiles) * 100}%` }} />
        </div>
      )}

      {jobStatus.totalDocuments > 0 && (
        <p className="text-xs text-blue-600">Created {jobStatus.totalDocuments} document chunks</p>
      )}
    </div>
  )
}

// --------------------
// Main Modal (wires everything together)
// --------------------
export default function MinioStorageModal({ isOpen, onClose }: MinioStorageModalProps) {
  const [activeTab, setActiveTab] = useState('files')

  // Files list with SWR
  const { data: filesData, error: filesError } = useSWR('/api/storage', fetcher)

  // Config
  const { data: configData } = useSWR('/api/config', fetcher)
  const chunkSize = configData?.chunkSize ?? 1000
  const overlap = configData?.overlap ?? 200
  const [localChunkSize, setLocalChunkSize] = useState(chunkSize)
  const [localOverlap, setLocalOverlap] = useState(overlap)

  // Job status with polling while there's an active job
  const { data: jobData } = useSWR('/api/storage/index/status', fetcher, {
    refreshInterval: (data) => {
      if (!data) return 0
      // poll when job exists and is active
      return ['pending', 'processing', 'paused'].includes(data.status) ? 10000 : 0
    }
  })

  const jobStatus = jobData

  // Helper to revalidate files list
  const mutateFiles = useCallback(() => mutate('/api/storage'), [])

  // ensure local config sync when server data loads
  React.useEffect(() => {
    if (configData) {
      setLocalChunkSize(configData.chunkSize ?? localChunkSize)
      setLocalOverlap(configData.overlap ?? localOverlap)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configData])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogPortal>
        <DialogContent className="sm:max-w-[80vw] max-w-[90vw] max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="space-y-3 p-6 pb-4 border-b flex-shrink-0">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2"><FolderOpen className="h-6 w-6 text-blue-600" />File Storage Management</DialogTitle>
            <DialogDescription>Manage your files, configuration, and indexing logs in MinIO storage</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col flex-1 overflow-hidden px-6 pt-4 gap-4 pb-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 overflow-hidden">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="files" className="flex items-center gap-2"><File className="h-4 w-4" />Files</TabsTrigger>
                <TabsTrigger value="config" className="flex items-center gap-2"><Settings className="h-4 w-4" />Configuration</TabsTrigger>
                <TabsTrigger value="logs" className="flex items-center gap-2"><FileText className="h-4 w-4" />Indexing Logs</TabsTrigger>
              </TabsList>

              <TabsContent value="files" className="flex flex-col flex-1 overflow-hidden mt-4">
                <JobProgress jobStatus={jobStatus} />
                <FilesTab files={filesData?.files} isLoading={!filesData && !filesError} mutateFiles={mutateFiles} jobStatus={jobStatus} />
              </TabsContent>

              <TabsContent value="config" className="flex flex-col flex-1 overflow-hidden mt-4">
                <ConfigTab chunkSize={localChunkSize} overlap={localOverlap} setChunkSize={setLocalChunkSize} setOverlap={setLocalOverlap} />
              </TabsContent>

              <TabsContent value="logs" className="flex flex-col flex-1 overflow-hidden mt-4">
                <div className="flex items-center justify-between mb-4 flex-shrink-0">
                  <div className="flex items-center gap-2"><h3 className="text-lg font-semibold">Indexing Logs</h3>{jobStatus && <span className="text-sm text-muted-foreground">Job: {jobStatus.id}</span>}</div>
                </div>

                <LogsTab jobStatus={jobStatus} />
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  )
}
