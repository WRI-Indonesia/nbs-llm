'use client'

import { useState, useEffect, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogPortal } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableCell, TableHead } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Upload, Trash2, RefreshCw, File, Loader2, Search, FolderOpen, X, Database, Square, PauseCircle, PlayCircle } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'

interface FileItem {
  name: string
  size: number
  lastModified: string
  etag: string
}

interface MinioStorageModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function MinioStorageModal({ isOpen, onClose }: MinioStorageModalProps) {
  const [files, setFiles] = useState<FileItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [indexing, setIndexing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [jobStatus, setJobStatus] = useState<any>(null)
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null)

  const fetchFiles = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/storage')
      if (!response.ok) {
        throw new Error('Failed to fetch files')
      }
      const data = await response.json()
      setFiles(data.files || [])
    } catch (error) {
      console.error('Error fetching files:', error)
      toast.error('Failed to load files')
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch job status
  const fetchJobStatus = async () => {
    try {
      const response = await fetch('/api/storage/index/status')
      if (response.ok) {
        const status = await response.json()
        if (status.status && status.status !== 'no-job') {
          setJobStatus(status)
          
          // Determine if indexing is active
          if (status.status === 'pending' || status.status === 'processing' || status.status === 'paused') {
            setIndexing(true)
          } else {
            setIndexing(false)
          }
          
          if (status.status === 'completed' || status.status === 'failed' || status.status === 'cancelled') {
            // Stop polling when job is done
            if (pollingInterval) {
              clearInterval(pollingInterval)
              setPollingInterval(null)
            }
            setIndexing(false)
            
            if (status.status === 'completed') {
              toast.success(`Indexing completed: ${status.totalDocuments} document chunks created`)
            } else if (status.status === 'failed') {
              toast.error(`Indexing failed: ${status.error || 'Unknown error'}`)
            } else if (status.status === 'cancelled') {
              toast.info('Indexing job cancelled')
            }
          }
        } else {
          // No job found
          setJobStatus(null)
          setIndexing(false)
        }
      }
    } catch (error) {
      console.error('Error fetching job status:', error)
      setJobStatus(null)
      setIndexing(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchFiles()
      setSearchTerm('')
      
      // Fetch status immediately when modal opens
      fetchJobStatus()
      
      // Start polling for job status (only for active jobs)
      const interval = setInterval(fetchJobStatus, 2000)
      setPollingInterval(interval)
      
      return () => {
        clearInterval(interval)
      }
    } else {
      // Clear polling when modal closes
      if (pollingInterval) {
        clearInterval(pollingInterval)
        setPollingInterval(null)
      }
      setJobStatus(null)
      setIndexing(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (file.type !== 'application/pdf') {
      toast.error('Please select a PDF file')
      event.target.value = ''
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/storage', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Failed to upload file')
      }

      toast.success('File uploaded successfully')
      fetchFiles()
    } catch (error) {
      console.error('Error uploading file:', error)
      toast.error('Failed to upload file')
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  const handleDelete = async (fileName: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"?`)) return

    setDeleting(fileName)
    try {
      const response = await fetch(`/api/storage?fileName=${encodeURIComponent(fileName)}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete file')
      }

      toast.success('File deleted successfully')
      fetchFiles()
    } catch (error) {
      console.error('Error deleting file:', error)
      toast.error('Failed to delete file')
    } finally {
      setDeleting(null)
    }
  }

  const handleIndex = async () => {
    setIndexing(true)
    try {
      const response = await fetch('/api/storage/index')
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to queue indexing job')
      }

      const data = await response.json()
      
      if (data.jobId) {
        toast.success(`Indexing job queued! Processing ${data.totalFiles} PDF files...`)
        setJobStatus({ status: 'pending', ...data })
      }
    } catch (error) {
      console.error('Error indexing files:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to index files')
      setIndexing(false)
    }
  }

  const handleControl = async (action: 'pause' | 'resume' | 'cancel') => {
    if (!jobStatus?.id) return

    try {
      const response = await fetch(`/api/storage/index/control?jobId=${jobStatus.id}&action=${action}`, {
        method: 'POST',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to control job')
      }

      const data = await response.json()
      
      if (action === 'cancel') {
        toast.success('Indexing job cancelled')
        setJobStatus(null)
        setIndexing(false)
      } else if (action === 'pause') {
        toast.success('Indexing job paused')
      } else if (action === 'resume') {
        toast.success('Indexing job resumed')
      }
      
      // Fetch updated status
      setTimeout(() => fetchJobStatus(), 500)
    } catch (error) {
      console.error('Error controlling job:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to control job')
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  // Extract just filename from full path
  const getFileName = (fullPath: string) => {
    return fullPath.split('/').pop() || fullPath
  }

  // Filter files based on search
  const filteredFiles = useMemo(() => {
    if (!searchTerm.trim()) return files
    const query = searchTerm.toLowerCase()
    return files.filter(file => 
      getFileName(file.name).toLowerCase().includes(query)
    )
  }, [files, searchTerm])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogPortal>
        <DialogContent className="sm:max-w-[60vw] max-w-90vw max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="space-y-3 p-6 pb-4 border-b flex-shrink-0">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <FolderOpen className="h-6 w-6 text-blue-600" />
              File Storage Management
            </DialogTitle>
            <DialogDescription>
              Manage your files in MinIO storage bucket
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col flex-1 overflow-hidden p-6 pt-4 gap-4">
            {/* Action Bar */}
            <div className="flex items-center justify-between gap-4 flex-shrink-0">
              {/* Search */}
              <form
                className="flex items-center gap-2 flex-1 max-w-xl"
                onSubmit={(e) => e.preventDefault()}
              >
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search files..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-8"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted"
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )}
                </div>
              </form>

              {/* Upload, Index, and Refresh */}
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  accept=".pdf,application/pdf"
                  onChange={handleUpload}
                  disabled={uploading}
                />
                <label htmlFor="file-upload">
                  <Button
                    variant="outline"
                    disabled={uploading}
                    asChild
                  >
                    <span>
                      {uploading ? <Spinner className="w-4 h-4 mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                      {uploading ? 'Uploading...' : 'Upload PDF'}
                    </span>
                  </Button>
                </label>
                <Button
                  variant="default"
                  onClick={jobStatus?.status === 'paused' ? () => handleControl('resume') : handleIndex}
                  disabled={indexing || uploading || isLoading || (jobStatus?.status === 'processing')}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {jobStatus?.status === 'paused' ? (
                    <>
                      <PlayCircle className="w-4 h-4 mr-2" />
                      Resume
                    </>
                  ) : (indexing || jobStatus?.status === 'processing') ? (
                    <>
                      <Spinner className="w-4 h-4 mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Database className="w-4 h-4 mr-2" />
                      Index Files
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={fetchFiles}
                  disabled={isLoading}
                >
                  {isLoading ? <Spinner className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Job Progress Indicator */}
            {jobStatus && (jobStatus.status === 'pending' || jobStatus.status === 'processing' || jobStatus.status === 'paused') && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex-shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-blue-900">
                      {jobStatus.status === 'paused' ? 'Indexing paused' : 'Indexing in progress...'}
                    </span>
                    <div className="flex gap-2">
                      {jobStatus.status === 'paused' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleControl('resume')}
                          className="bg-green-50 hover:bg-green-100 border-green-300 text-green-700"
                        >
                          <PlayCircle className="w-3.5 h-3.5 mr-1.5" />
                          Resume
                        </Button>
                      )}
                      {(jobStatus.status === 'processing' || jobStatus.status === 'pending') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleControl('pause')}
                          className="bg-yellow-50 hover:bg-yellow-100 border-yellow-300 text-yellow-700"
                        >
                          <PauseCircle className="w-3.5 h-3.5 mr-1.5" />
                          Pause
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleControl('cancel')}
                        className="bg-red-50 hover:bg-red-100 border-red-300 text-red-700"
                      >
                        <Square className="w-3.5 h-3.5 mr-1.5" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                  <span className="text-sm text-blue-700">
                    {jobStatus.processedFiles || 0} of {jobStatus.totalFiles || 0} files
                  </span>
                </div>
                {jobStatus.totalFiles > 0 && (
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${((jobStatus.processedFiles || 0) / jobStatus.totalFiles) * 100}%` }}
                    />
                  </div>
                )}
                {jobStatus.totalDocuments > 0 && (
                  <p className="text-xs text-blue-600 mt-2">
                    Created {jobStatus.totalDocuments} document chunks
                  </p>
                )}
              </div>
            )}

            {/* Table */}
            <div className="flex-1 overflow-auto border rounded-lg min-h-0">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-64">
                  <Spinner className="w-8 h-8" />
                  <p className="mt-4 text-sm text-muted-foreground">Loading files...</p>
                </div>
              ) : filteredFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <File className="h-12 w-12 mb-4 text-muted-foreground/50" />
                  <p className="text-lg font-medium">
                    {searchTerm ? 'No files found' : 'No files'}
                  </p>
                  <p className="text-sm">
                    {searchTerm ? 'Try adjusting your search' : 'Upload a file to get started'}
                  </p>
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
                    {filteredFiles.map((file) => (
                      <TableRow key={file.name} className="hover:bg-slate-50/30">
                        <TableCell>
                          <div className='flex items-center justify-center'>
                          <File className="w-4 h-4 text-blue-600" />
                          </div>
                        </TableCell>
                        <TableCell className="font-medium max-w-[300px] truncate">{getFileName(file.name)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatFileSize(file.size)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {file.lastModified
                            ? new Date(file.lastModified).toLocaleDateString()
                            : 'N/A'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(file.name)}
                            disabled={deleting === file.name}
                          >
                            {deleting === file.name ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4 text-red-500" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Stats */}
            <div className="flex items-center justify-between pt-2 border-t flex-shrink-0 text-sm text-muted-foreground">
              <span>
                {filteredFiles.length} {filteredFiles.length === 1 ? 'file' : 'files'}
                {searchTerm && ` (filtered from ${files.length})`}
              </span>
            </div>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  )
}
