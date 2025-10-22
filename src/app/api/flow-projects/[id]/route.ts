import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Node, Edge } from '@xyflow/react'
import type { TableNodeData } from '@/types/table-nodes'
import { isAdmin } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check if user is admin
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { id: projectId } = await params

    const project = await prisma.flowProject.findUnique({
      where: { id: projectId },
      include: {
        nodes: true,
        edges: true,
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Convert to React Flow format
    const nodes: Node<TableNodeData>[] = project.nodes.map((node: any) => ({
      id: node.nodeId,
      type: node.type,
      position: node.position as { x: number; y: number },
      data: node.data as unknown as TableNodeData,
    }))

    const edges: Edge[] = project.edges.map((edge: any) => ({
      id: edge.edgeId,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      type: edge.type || undefined,
    }))

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
      nodes,
      edges,
    })
  } catch (error) {
    console.error('Error fetching flow project:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check if user is admin
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { id: projectId } = await params
    const body = await request.json()
    const { name, description, nodes, edges } = body

    // Check if project exists
    const existingProject = await prisma.flowProject.findUnique({
      where: { id: projectId },
    })

    if (!existingProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Update project metadata
    const project = await prisma.flowProject.update({
      where: { id: projectId },
      data: {
        name: name || existingProject.name,
        description: description !== undefined ? description : existingProject.description,
        updatedAt: new Date()
      },
    })

    // Update nodes
    if (nodes !== undefined) {
      // Delete existing nodes
      await prisma.flowNode.deleteMany({
        where: { projectId },
      })

      // Create new nodes
      if (nodes.length > 0) {
        await prisma.flowNode.createMany({
          data: nodes.map((node: Node<TableNodeData>) => ({
            projectId,
            nodeId: node.id,
            type: node.type || 'table',
            position: node.position,
            data: node.data,
          })),
        })
      }
    }

    // Update edges
    if (edges !== undefined) {
      // Delete existing edges
      await prisma.flowEdge.deleteMany({
        where: { projectId },
      })

      // Create new edges
      if (edges.length > 0) {
        await prisma.flowEdge.createMany({
          data: edges.map((edge: Edge) => ({
            projectId,
            edgeId: edge.id,
            source: edge.source,
            target: edge.target,
            sourceHandle: edge.sourceHandle,
            targetHandle: edge.targetHandle,
            type: edge.type,
          })),
        })
      }
    }

    return NextResponse.json({ project })
  } catch (error) {
    console.error('Error updating flow project:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
