import { Node, Edge } from '@xyflow/react'
import type { TableNodeData } from '@/types/table-nodes'

export interface FlowProject {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
}

export interface FlowProjectResponse {
  project: FlowProject
  nodes: Node<TableNodeData>[]
  edges: Edge[]
}
