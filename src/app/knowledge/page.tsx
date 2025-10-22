'use client'

import {
    ReactFlow,
    Controls,
    Background,
    Panel,
} from '@xyflow/react'
import { Plus, Download, Save } from 'lucide-react'
import { usePlayground } from './_hooks/usePlayground'
import { Button } from '@/components/ui/button'
import TableNode from './_components/table-node'


export default function PlaygroundPage() {
    const { handleDownloadSample, nodes, edges, saveProject } = usePlayground()

    return (
        <div className="pt-14 w-screen h-screen">
            <ReactFlow
                // key={refreshKey}
                nodes={nodes}
                edges={edges}
                // onNodesChange={handleNodesChange}
                // onEdgesChange={handleEdgesChange}
                // onConnect={handleConnect}
                nodeTypes={{ table: TableNode }}
                fitView
                fitViewOptions={{ padding: 0.3 }}
            >
                <Background />
                <Controls />
                <Panel position="top-left" className='flex flex-col items-center gap-2 shadow-sm p-2 border-neutral-200 border rounded-md bg-white'>
                    <Button variant="secondary" color="gray" title="save" onClick={saveProject}>
                        <Save className="w-4 h-4" />
                    </Button>

                    <Button variant="secondary" color="gray" title="add table">
                        <Plus className="w-4 h-4" />
                    </Button>

                    <Button variant="secondary" color="gray" title="download sample" onClick={handleDownloadSample}>
                        <Download className="w-4 h-4" />
                    </Button>
                </Panel>
            </ReactFlow>
        </div>
    )
}

