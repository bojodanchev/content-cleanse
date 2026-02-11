import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/faces — list user's saved faces
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: faces, error } = await supabase
      .from('faces')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch faces' }, { status: 500 })
    }

    return NextResponse.json({ faces })
  } catch (error) {
    console.error('List faces error:', error)
    return NextResponse.json({ error: 'Failed to fetch faces' }, { status: 500 })
  }
}

// POST /api/faces — save a new face profile
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, filePath } = await request.json()

    if (!name || !filePath) {
      return NextResponse.json({ error: 'Name and file path required' }, { status: 400 })
    }

    const serviceClient = createServiceClient()
    const { data: face, error } = await serviceClient
      .from('faces')
      .insert({
        user_id: user.id,
        name,
        file_path: filePath,
      })
      .select()
      .single()

    if (error) {
      console.error('Create face error:', error)
      return NextResponse.json({ error: 'Failed to save face' }, { status: 500 })
    }

    return NextResponse.json({ face })
  } catch (error) {
    console.error('Create face error:', error)
    return NextResponse.json({ error: 'Failed to save face' }, { status: 500 })
  }
}

// DELETE /api/faces — delete a face profile
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { faceId } = await request.json()

    if (!faceId) {
      return NextResponse.json({ error: 'Face ID required' }, { status: 400 })
    }

    const serviceClient = createServiceClient()

    // Fetch face to get file path for storage cleanup
    const { data: face } = await serviceClient
      .from('faces')
      .select('*')
      .eq('id', faceId)
      .eq('user_id', user.id)
      .single()

    if (!face) {
      return NextResponse.json({ error: 'Face not found' }, { status: 404 })
    }

    // Delete from storage
    await serviceClient.storage.from('faces').remove([face.file_path])

    // Delete from database
    await serviceClient
      .from('faces')
      .delete()
      .eq('id', faceId)
      .eq('user_id', user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete face error:', error)
    return NextResponse.json({ error: 'Failed to delete face' }, { status: 500 })
  }
}
