'use client'

import {
    ReactFlow,
    Controls,
    Background,
    Panel,
} from '@xyflow/react'
import { Plus, Download, Save, FolderOpen } from 'lucide-react'
import { useKnowledge } from './_hooks/useKnowledge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { LuRefreshCw } from "react-icons/lu";
import TableNode from './_components/table-node'
import { useState } from 'react'
import MinioStorageModal from './_components/minio-storage-modal'


export default function KnowledgePage() {
    const { handleDownloadSample, nodes, edges, saveProject, isLoading, isDataLoading, handleNodesChange, handleEdgesChange, addNewTable, handleRefreshIndex } = useKnowledge()
    const [isStorageModalOpen, setIsStorageModalOpen] = useState(false)

    return (
        <div className="pt-14 w-screen h-screen">
            <MinioStorageModal isOpen={isStorageModalOpen} onClose={() => setIsStorageModalOpen(false)} />
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
                nodeTypes={{ table: TableNode }}
                fitView
                fitViewOptions={{ padding: 0.3 }}
            >
                <Background />
                <Controls />
                <Panel position="top-left" className='flex flex-col items-center gap-2 shadow-sm p-2 border-neutral-200 border rounded-md bg-white'>
                    <Button
                        variant="secondary"
                        color="gray"
                        title="save"
                        onClick={saveProject}
                        disabled={isLoading || isDataLoading}
                    >
                        {(isLoading || isDataLoading) ? <Spinner className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                    </Button>

                    <Button
                        variant="secondary"
                        color="gray"
                        title="add table"
                        onClick={addNewTable}
                        disabled={isDataLoading}
                    >
                        {isDataLoading ? <Spinner className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </Button>

                    <Button
                        variant="secondary"
                        color="gray"
                        title="download sample"
                        onClick={handleDownloadSample}
                        disabled={isDataLoading}
                    >
                        {isDataLoading ? <Spinner className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                    </Button>

                    <Button
                        variant="secondary"
                        color="gray"
                        title="refresh-index"
                        onClick={handleRefreshIndex}
                        disabled={isLoading || isDataLoading}
                    >
                        {(isLoading || isDataLoading) ? <Spinner className="w-4 h-4" /> : <LuRefreshCw className="w-4 h-4" />}
                    </Button>

                    <Button
                        variant="secondary"
                        color="gray"
                        title="file storage"
                        onClick={() => setIsStorageModalOpen(true)}
                        disabled={isDataLoading}
                    >
                        {isDataLoading ? <Spinner className="w-4 h-4" /> : <FolderOpen className="w-4 h-4" />}
                    </Button>
                </Panel>
            </ReactFlow>
        </div>
    )
}

