'use client'

import { useState, useEffect, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogPortal } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableCell, TableHead } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Upload, Trash2, RefreshCw, File, Loader2, Search, FolderOpen, X, Database } from 'lucide-react'
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

  useEffect(() => {
    if (isOpen) {
      fetchFiles()
      setSearchTerm('')
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
        throw new Error(error.error || 'Failed to index files')
      }

      const data = await response.json()
      
      toast.success(`Successfully indexed ${data.totalFiles} files with ${data.totalDocuments} document chunks`)
      
      // Show additional info
      if (data.processedFiles) {
        console.log('Indexed files:', data.processedFiles)
      }
    } catch (error) {
      console.error('Error indexing files:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to index files')
    } finally {
      setIndexing(false)
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
                  onClick={handleIndex}
                  disabled={indexing || uploading || isLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {indexing ? <Spinner className="w-4 h-4 mr-2" /> : <Database className="w-4 h-4 mr-2" />}
                  {indexing ? 'Indexing...' : 'Index Files'}
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
