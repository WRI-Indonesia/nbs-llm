'use client'

import React, { useCallback, useMemo, useState } from 'react'
import useSWR, { mutate } from 'swr'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogPortal } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableCell, TableHead } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Upload, Trash2, RefreshCw, File, Loader2, Search, FolderOpen, X, Database, PlayCircle, Settings, FileText, AlertCircle, PauseCircle } from 'lucide-react'
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
  const [pausing, setPausing] = useState(false)
  const [resuming, setResuming] = useState(false)
  const [cancelling, setCancelling] = useState(false)

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

  const handleControl = async (action: 'pause' | 'resume' | 'cancel') => {
    if (!jobStatus?.id) return
    const actionStateSetter = action === 'pause' ? setPausing : action === 'resume' ? setResuming : setCancelling
    actionStateSetter(true)
    try {
      const res = await fetch(`/api/storage/index/control?jobId=${encodeURIComponent(jobStatus.id)}&action=${action}`, { method: 'POST' })
      const body = await res.json().catch(() => ({} as any))
      if (!res.ok) throw new Error(body?.error || `Failed to ${action}`)
      toast.success(body?.message || `${action[0].toUpperCase()}${action.slice(1)}d successfully`)
      mutate('/api/storage/index/status')
      if (action !== 'cancel') {
        mutate(`/api/storage/index/logs?jobId=${jobStatus.id}`)
      }
    } catch (err) {
      console.error(err)
      toast.error((err as Error).message || `Failed to ${action}`)
    } finally {
      actionStateSetter(false)
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

          {jobStatus?.status === 'processing' || jobStatus?.status === 'pending' ? (
            <>
              <Button variant="secondary" onClick={() => handleControl('pause')} disabled={pausing || uploading || isLoading}>
                {pausing ? (<><Spinner className="w-4 h-4 mr-2" />Pausing...</>) : (<><PauseCircle className="w-4 h-4 mr-2" />Pause</>)}
              </Button>
              <Button variant="destructive" onClick={() => handleControl('cancel')} disabled={cancelling || uploading || isLoading}>
                {cancelling ? (<><Spinner className="w-4 h-4 mr-2" />Cancelling...</>) : (<><X className="w-4 h-4 mr-2" />Cancel</>)}
              </Button>
            </>
          ) : jobStatus?.status === 'paused' ? (
            <>
              <Button variant="default" onClick={() => handleControl('resume')} disabled={resuming || uploading || isLoading}>
                {resuming ? (<><Spinner className="w-4 h-4 mr-2" />Resuming...</>) : (<><PlayCircle className="w-4 h-4 mr-2" />Resume</>)}
              </Button>
              <Button variant="destructive" onClick={() => handleControl('cancel')} disabled={cancelling || uploading || isLoading}>
                {cancelling ? (<><Spinner className="w-4 h-4 mr-2" />Cancelling...</>) : (<><X className="w-4 h-4 mr-2" />Cancel</>)}
              </Button>
            </>
          ) : (
            <Button variant="default" onClick={handleIndex} disabled={indexing || uploading || isLoading}>
              {indexing ? (<><Spinner className="w-4 h-4 mr-2" />Starting...</>) : (<><Database className="w-4 h-4 mr-2" />Index Files</>)}
            </Button>
          )}

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
interface ConfigTabProps {
  // Document chunking
  chunkSize: number
  overlap: number
  topK: number
  minCos: number
  setChunkSize: (v: number) => void
  setOverlap: (v: number) => void
  setTopK: (v: number) => void
  setMinCos: (v: number) => void
  // Cache
  cacheEnabled: boolean
  semanticTopK: number
  cacheTtlSemretr: number
  setCacheEnabled: (v: boolean) => void
  setSemanticTopK: (v: number) => void
  setCacheTtlSemretr: (v: number) => void
  // Hybrid search
  useHybridSearch: boolean
  hybridMinCosine: number
  hybridTopK: number
  hybridAlpha: number
  setUseHybridSearch: (v: boolean) => void
  setHybridMinCosine: (v: number) => void
  setHybridTopK: (v: number) => void
  setHybridAlpha: (v: number) => void
  // Reranking
  rerankEnabled: boolean
  rerankTopN: number
  rerankModelName: string
  setRerankEnabled: (v: boolean) => void
  setRerankTopN: (v: number) => void
  setRerankModelName: (v: string) => void
  // Model configurations
  repromptAgentModel: string
  sqlGeneratorAgentModel: string
  embeddingAgentModel: string
  summarizationModelEndpoint: string
  summarizationModel: string
  setRepromptAgentModel: (v: string) => void
  setSqlGeneratorAgentModel: (v: string) => void
  setEmbeddingAgentModel: (v: string) => void
  setSummarizationModelEndpoint: (v: string) => void
  setSummarizationModel: (v: string) => void
}

function ConfigTab(props: ConfigTabProps) {
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chunkSize: props.chunkSize,
          overlap: props.overlap,
          topK: props.topK,
          minCos: props.minCos,
          cacheEnabled: props.cacheEnabled,
          semanticTopK: props.semanticTopK,
          cacheTtlSemretr: props.cacheTtlSemretr,
          useHybridSearch: props.useHybridSearch,
          hybridMinCosine: props.hybridMinCosine,
          hybridTopK: props.hybridTopK,
          hybridAlpha: props.hybridAlpha,
          rerankEnabled: props.rerankEnabled,
          rerankTopN: props.rerankTopN,
          rerankModelName: props.rerankModelName,
          repromptAgentModel: props.repromptAgentModel,
          sqlGeneratorAgentModel: props.sqlGeneratorAgentModel,
          embeddingAgentModel: props.embeddingAgentModel,
          summarizationModelEndpoint: props.summarizationModelEndpoint,
          summarizationModel: props.summarizationModel,
        })
      })
      if (!res.ok) throw new Error('Failed to save')
      await res.json()
      toast.success('Configuration saved')
      mutate('/api/config')
    } catch (err) {
      console.error(err)
      toast.error((err as Error).message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <div className="space-y-6 p-6">
        {/* Document Chunking Section */}
        <div className="border rounded-lg p-6 bg-slate-50/50">
          <h3 className="text-lg font-semibold mb-4">Document Chunking</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-3">
              <Label htmlFor="chunkSize">Chunk size (characters)</Label>
              <input id="chunkSize" type="range" min={200} max={8000} step={100} value={props.chunkSize} onChange={(e) => props.setChunkSize(parseInt(e.target.value))} className="w-full" />
              <div className="text-sm text-muted-foreground">Current: <span className="font-medium">{props.chunkSize} characters</span></div>
              <p className="text-xs text-muted-foreground">The size of text chunks to split documents into. Larger chunks capture more context but may lose fine-grained details.</p>
            </div>
            <div className="flex flex-col gap-3">
              <Label htmlFor="overlap">Overlap (characters)</Label>
              <input id="overlap" type="range" min={0} max={Math.max(0, Math.min(props.chunkSize - 1, 4000))} step={50} value={props.overlap} onChange={(e) => props.setOverlap(parseInt(e.target.value))} className="w-full" />
              <div className="text-sm text-muted-foreground">Current: <span className="font-medium">{props.overlap} characters</span></div>
              <p className="text-xs text-muted-foreground">The number of characters to overlap between consecutive chunks. Helps maintain context across chunk boundaries.</p>
            </div>
            <div className="flex flex-col gap-3">
              <Label htmlFor="topK">Top K results</Label>
              <input id="topK" type="range" min={1} max={20} step={1} value={props.topK} onChange={(e) => props.setTopK(parseInt(e.target.value))} className="w-full" />
              <div className="text-sm text-muted-foreground">Current: <span className="font-medium">{props.topK}</span></div>
              <p className="text-xs text-muted-foreground">Maximum number of documents to retrieve per source.</p>
            </div>
            <div className="flex flex-col gap-3">
              <Label htmlFor="minCos">Min cosine similarity</Label>
              <input id="minCos" type="range" min={0} max={1} step={0.01} value={props.minCos} onChange={(e) => props.setMinCos(parseFloat(e.target.value))} className="w-full" />
              <div className="text-sm text-muted-foreground">Current: <span className="font-medium">{props.minCos.toFixed(2)}</span></div>
              <p className="text-xs text-muted-foreground">Minimum similarity threshold for retrieved documents.</p>
            </div>
          </div>
        </div>

        {/* Cache Section */}
        <div className="border rounded-lg p-6 bg-slate-50/50">
          <h3 className="text-lg font-semibold mb-4">Cache Configuration</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <Label htmlFor="cacheEnabled">Cache Enabled</Label>
                <p className="text-xs text-muted-foreground">Enable caching for semantic retrieval results</p>
              </div>
              <input id="cacheEnabled" type="checkbox" checked={props.cacheEnabled} onChange={(e) => props.setCacheEnabled(e.target.checked)} className="h-4 w-4" />
            </div>
            <div className="flex flex-col gap-3">
              <Label htmlFor="semanticTopK">Semantic Top K</Label>
              <input id="semanticTopK" type="number" min={1} max={100} value={props.semanticTopK} onChange={(e) => props.setSemanticTopK(parseInt(e.target.value) || 10)} className="w-full px-3 py-2 border rounded-md" />
              <p className="text-xs text-muted-foreground">Number of top semantic results to cache</p>
            </div>
            <div className="flex flex-col gap-3">
              <Label htmlFor="cacheTtlSemretr">Cache TTL (seconds)</Label>
              <input id="cacheTtlSemretr" type="number" min={0} value={props.cacheTtlSemretr} onChange={(e) => props.setCacheTtlSemretr(parseInt(e.target.value) || 1800)} className="w-full px-3 py-2 border rounded-md" />
              <p className="text-xs text-muted-foreground">Time to live for cached semantic retrieval results</p>
            </div>
          </div>
        </div>

        {/* Hybrid Search Section */}
        <div className="border rounded-lg p-6 bg-slate-50/50">
          <h3 className="text-lg font-semibold mb-4">Hybrid Search Configuration</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <Label htmlFor="useHybridSearch">Use Hybrid Search</Label>
                <p className="text-xs text-muted-foreground">Enable hybrid search combining semantic and keyword search</p>
              </div>
              <input id="useHybridSearch" type="checkbox" checked={props.useHybridSearch} onChange={(e) => props.setUseHybridSearch(e.target.checked)} className="h-4 w-4" />
            </div>
            <div className="flex flex-col gap-3">
              <Label htmlFor="hybridMinCosine">Hybrid Min Cosine</Label>
              <input id="hybridMinCosine" type="range" min={0} max={1} step={0.01} value={props.hybridMinCosine} onChange={(e) => props.setHybridMinCosine(parseFloat(e.target.value))} className="w-full" />
              <div className="text-sm text-muted-foreground">Current: <span className="font-medium">{props.hybridMinCosine.toFixed(2)}</span></div>
              <p className="text-xs text-muted-foreground">Minimum cosine similarity threshold for hybrid search</p>
            </div>
            <div className="flex flex-col gap-3">
              <Label htmlFor="hybridTopK">Hybrid Top K</Label>
              <input id="hybridTopK" type="number" min={1} max={100} value={props.hybridTopK} onChange={(e) => props.setHybridTopK(parseInt(e.target.value) || 5)} className="w-full px-3 py-2 border rounded-md" />
              <p className="text-xs text-muted-foreground">Number of top results for hybrid search</p>
            </div>
            <div className="flex flex-col gap-3">
              <Label htmlFor="hybridAlpha">Hybrid Alpha</Label>
              <input id="hybridAlpha" type="range" min={0} max={1} step={0.01} value={props.hybridAlpha} onChange={(e) => props.setHybridAlpha(parseFloat(e.target.value))} className="w-full" />
              <div className="text-sm text-muted-foreground">Current: <span className="font-medium">{props.hybridAlpha.toFixed(2)}</span></div>
              <p className="text-xs text-muted-foreground">Weight for semantic vs keyword search (0 = keyword only, 1 = semantic only)</p>
            </div>
          </div>
        </div>

        {/* Reranking Section */}
        <div className="border rounded-lg p-6 bg-slate-50/50">
          <h3 className="text-lg font-semibold mb-4">Reranking Configuration</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <Label htmlFor="rerankEnabled">Rerank Enabled</Label>
                <p className="text-xs text-muted-foreground">Enable reranking of search results</p>
              </div>
              <input id="rerankEnabled" type="checkbox" checked={props.rerankEnabled} onChange={(e) => props.setRerankEnabled(e.target.checked)} className="h-4 w-4" />
            </div>
            <div className="flex flex-col gap-3">
              <Label htmlFor="rerankTopN">Rerank Top N</Label>
              <input id="rerankTopN" type="number" min={1} max={100} value={props.rerankTopN} onChange={(e) => props.setRerankTopN(parseInt(e.target.value) || 20)} className="w-full px-3 py-2 border rounded-md" />
              <p className="text-xs text-muted-foreground">Number of results to rerank</p>
            </div>
            <div className="flex flex-col gap-3 md:col-span-2">
              <Label htmlFor="rerankModelName">Rerank Model Name</Label>
              <Input id="rerankModelName" value={props.rerankModelName} onChange={(e) => props.setRerankModelName(e.target.value)} placeholder="cross-encoder/ms-marco-MiniLM-L-6-v2" />
              <p className="text-xs text-muted-foreground">Model name for reranking</p>
            </div>
          </div>
        </div>

        {/* Model Configuration Section */}
        <div className="border rounded-lg p-6 bg-slate-50/50">
          <h3 className="text-lg font-semibold mb-4">Model Configuration</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-3">
              <Label htmlFor="repromptAgentModel">Reprompt Agent Model</Label>
              <Input id="repromptAgentModel" value={props.repromptAgentModel} onChange={(e) => props.setRepromptAgentModel(e.target.value)} placeholder="gpt-4o-mini" />
              <p className="text-xs text-muted-foreground">Model used for reprompting queries</p>
            </div>
            <div className="flex flex-col gap-3">
              <Label htmlFor="sqlGeneratorAgentModel">SQL Generator Agent Model</Label>
              <Input id="sqlGeneratorAgentModel" value={props.sqlGeneratorAgentModel} onChange={(e) => props.setSqlGeneratorAgentModel(e.target.value)} placeholder="gpt-4o" />
              <p className="text-xs text-muted-foreground">Model used for SQL query generation</p>
            </div>
            <div className="flex flex-col gap-3">
              <Label htmlFor="embeddingAgentModel">Embedding Agent Model</Label>
              <Input id="embeddingAgentModel" value={props.embeddingAgentModel} onChange={(e) => props.setEmbeddingAgentModel(e.target.value)} placeholder="text-embedding-3-large" />
              <p className="text-xs text-muted-foreground">Model used for generating embeddings</p>
            </div>
            <div className="flex flex-col gap-3">
              <Label htmlFor="summarizationModel">Summarization Model</Label>
              <Input id="summarizationModel" value={props.summarizationModel} onChange={(e) => props.setSummarizationModel(e.target.value)} placeholder="SeaLLMs/SeaLLM-7B-v2.5" />
              <p className="text-xs text-muted-foreground">Model used for summarization</p>
            </div>
            <div className="flex flex-col gap-3 md:col-span-2">
              <Label htmlFor="summarizationModelEndpoint">Summarization Model Endpoint</Label>
              <Input id="summarizationModelEndpoint" value={props.summarizationModelEndpoint} onChange={(e) => props.setSummarizationModelEndpoint(e.target.value)} placeholder="https://seallm.wri-indonesia.or.id/v1/chat/completions" />
              <p className="text-xs text-muted-foreground">API endpoint for the summarization model</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Spinner className="w-4 h-4 mr-2" /> : <Settings className="w-4 h-4 mr-2" />}
            {saving ? 'Saving...' : 'Save Configuration'}
          </Button>
        </div>
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
  const topK = configData?.topK ?? 10
  const minCos = configData?.minCos ?? 0.2
  const cacheEnabled = configData?.cacheEnabled ?? true
  const semanticTopK = configData?.semanticTopK ?? 10
  const cacheTtlSemretr = configData?.cacheTtlSemretr ?? 1800
  const useHybridSearch = configData?.useHybridSearch ?? true
  const hybridMinCosine = configData?.hybridMinCosine ?? 0.2
  const hybridTopK = configData?.hybridTopK ?? 5
  const hybridAlpha = configData?.hybridAlpha ?? 0.7
  const rerankEnabled = configData?.rerankEnabled ?? true
  const rerankTopN = configData?.rerankTopN ?? 20
  const rerankModelName = configData?.rerankModelName ?? 'cross-encoder/ms-marco-MiniLM-L-6-v2'
  const repromptAgentModel = configData?.repromptAgentModel ?? 'gpt-4o-mini'
  const sqlGeneratorAgentModel = configData?.sqlGeneratorAgentModel ?? 'gpt-4o'
  const embeddingAgentModel = configData?.embeddingAgentModel ?? 'text-embedding-3-large'
  const summarizationModelEndpoint = configData?.summarizationModelEndpoint ?? 'https://seallm.wri-indonesia.or.id/v1/chat/completions'
  const summarizationModel = configData?.summarizationModel ?? 'SeaLLMs/SeaLLM-7B-v2.5'

  const [localChunkSize, setLocalChunkSize] = useState(chunkSize)
  const [localOverlap, setLocalOverlap] = useState(overlap)
  const [localTopK, setLocalTopK] = useState(topK)
  const [localMinCos, setLocalMinCos] = useState(minCos)
  const [localCacheEnabled, setLocalCacheEnabled] = useState(cacheEnabled)
  const [localSemanticTopK, setLocalSemanticTopK] = useState(semanticTopK)
  const [localCacheTtlSemretr, setLocalCacheTtlSemretr] = useState(cacheTtlSemretr)
  const [localUseHybridSearch, setLocalUseHybridSearch] = useState(useHybridSearch)
  const [localHybridMinCosine, setLocalHybridMinCosine] = useState(hybridMinCosine)
  const [localHybridTopK, setLocalHybridTopK] = useState(hybridTopK)
  const [localHybridAlpha, setLocalHybridAlpha] = useState(hybridAlpha)
  const [localRerankEnabled, setLocalRerankEnabled] = useState(rerankEnabled)
  const [localRerankTopN, setLocalRerankTopN] = useState(rerankTopN)
  const [localRerankModelName, setLocalRerankModelName] = useState(rerankModelName)
  const [localRepromptAgentModel, setLocalRepromptAgentModel] = useState(repromptAgentModel)
  const [localSqlGeneratorAgentModel, setLocalSqlGeneratorAgentModel] = useState(sqlGeneratorAgentModel)
  const [localEmbeddingAgentModel, setLocalEmbeddingAgentModel] = useState(embeddingAgentModel)
  const [localSummarizationModelEndpoint, setLocalSummarizationModelEndpoint] = useState(summarizationModelEndpoint)
  const [localSummarizationModel, setLocalSummarizationModel] = useState(summarizationModel)

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
      setLocalTopK(configData.topK ?? localTopK)
      setLocalMinCos(configData.minCos ?? localMinCos)
      setLocalCacheEnabled(configData.cacheEnabled ?? localCacheEnabled)
      setLocalSemanticTopK(configData.semanticTopK ?? localSemanticTopK)
      setLocalCacheTtlSemretr(configData.cacheTtlSemretr ?? localCacheTtlSemretr)
      setLocalUseHybridSearch(configData.useHybridSearch ?? localUseHybridSearch)
      setLocalHybridMinCosine(configData.hybridMinCosine ?? localHybridMinCosine)
      setLocalHybridTopK(configData.hybridTopK ?? localHybridTopK)
      setLocalHybridAlpha(configData.hybridAlpha ?? localHybridAlpha)
      setLocalRerankEnabled(configData.rerankEnabled ?? localRerankEnabled)
      setLocalRerankTopN(configData.rerankTopN ?? localRerankTopN)
      setLocalRerankModelName(configData.rerankModelName ?? localRerankModelName)
      setLocalRepromptAgentModel(configData.repromptAgentModel ?? localRepromptAgentModel)
      setLocalSqlGeneratorAgentModel(configData.sqlGeneratorAgentModel ?? localSqlGeneratorAgentModel)
      setLocalEmbeddingAgentModel(configData.embeddingAgentModel ?? localEmbeddingAgentModel)
      setLocalSummarizationModelEndpoint(configData.summarizationModelEndpoint ?? localSummarizationModelEndpoint)
      setLocalSummarizationModel(configData.summarizationModel ?? localSummarizationModel)
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
                <ConfigTab
                  chunkSize={localChunkSize}
                  overlap={localOverlap}
                  topK={localTopK}
                  minCos={localMinCos}
                  setChunkSize={setLocalChunkSize}
                  setOverlap={setLocalOverlap}
                  setTopK={setLocalTopK}
                  setMinCos={setLocalMinCos}
                  cacheEnabled={localCacheEnabled}
                  semanticTopK={localSemanticTopK}
                  cacheTtlSemretr={localCacheTtlSemretr}
                  setCacheEnabled={setLocalCacheEnabled}
                  setSemanticTopK={setLocalSemanticTopK}
                  setCacheTtlSemretr={setLocalCacheTtlSemretr}
                  useHybridSearch={localUseHybridSearch}
                  hybridMinCosine={localHybridMinCosine}
                  hybridTopK={localHybridTopK}
                  hybridAlpha={localHybridAlpha}
                  setUseHybridSearch={setLocalUseHybridSearch}
                  setHybridMinCosine={setLocalHybridMinCosine}
                  setHybridTopK={setLocalHybridTopK}
                  setHybridAlpha={setLocalHybridAlpha}
                  rerankEnabled={localRerankEnabled}
                  rerankTopN={localRerankTopN}
                  rerankModelName={localRerankModelName}
                  setRerankEnabled={setLocalRerankEnabled}
                  setRerankTopN={setLocalRerankTopN}
                  setRerankModelName={setLocalRerankModelName}
                  repromptAgentModel={localRepromptAgentModel}
                  sqlGeneratorAgentModel={localSqlGeneratorAgentModel}
                  embeddingAgentModel={localEmbeddingAgentModel}
                  summarizationModelEndpoint={localSummarizationModelEndpoint}
                  summarizationModel={localSummarizationModel}
                  setRepromptAgentModel={setLocalRepromptAgentModel}
                  setSqlGeneratorAgentModel={setLocalSqlGeneratorAgentModel}
                  setEmbeddingAgentModel={setLocalEmbeddingAgentModel}
                  setSummarizationModelEndpoint={setLocalSummarizationModelEndpoint}
                  setSummarizationModel={setLocalSummarizationModel}
                />
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
