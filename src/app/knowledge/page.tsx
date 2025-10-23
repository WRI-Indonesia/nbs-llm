'use client'

import {
    ReactFlow,
    Controls,
    Background,
    Panel,
} from '@xyflow/react'
import { Plus, Download, Save } from 'lucide-react'
import { useKnowledge } from './_hooks/useKnowledge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { LuRefreshCw } from "react-icons/lu";
import TableNode from './_components/table-node'


export default function KnowledgePage() {
    const { handleDownloadSample, nodes, edges, saveProject, isLoading, isDataLoading, handleNodesChange, handleEdgesChange } = useKnowledge()

    async function callGenerateRagDocs(projectId: string) {
        if (!projectId) {
            throw new Error("projectId is required")
        }

        const url = `/api/ai/index?projectId=${encodeURIComponent(projectId)}`

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        })

        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}))
            throw new Error(errorBody.error || `Request failed with status ${response.status}`)
        }

        return response.json()
    }

    async function callGenerateSchema(projectId: string) {
        if (!projectId) {
            throw new Error("projectId is required")
        }

        const url = `/api/ai/generate-schema`

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ projectId })
        })

        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}))
            throw new Error(errorBody.error || `Request failed with status ${response.status}`)
        }

        return response.json()
    }


    return (
        <div className="pt-14 w-screen h-screen">
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
                        onClick={async () => {
                            await callGenerateRagDocs('DEFAULT')
                            await callGenerateSchema('DEFAULT')
                        }}
                        disabled={isLoading || isDataLoading}
                    >
                        {(isLoading || isDataLoading) ? <Spinner className="w-4 h-4" /> : <LuRefreshCw className="w-4 h-4" />}
                    </Button>
                </Panel>
            </ReactFlow>
        </div>
    )
}

