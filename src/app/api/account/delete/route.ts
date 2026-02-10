import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export async function DELETE() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = user.id

    // Need raw admin client for auth.admin.deleteUser
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Delete user data in order (respecting foreign keys)

    // 1. Get user's affiliate IDs first
    const { data: affiliates } = await adminClient
      .from('affiliates')
      .select('id')
      .eq('user_id', userId)

    const affiliateIds = affiliates?.map((a: { id: string }) => a.id) || []

    if (affiliateIds.length > 0) {
      await adminClient.from('commissions').delete().in('affiliate_id', affiliateIds)
      await adminClient.from('referrals').delete().in('affiliate_id', affiliateIds)
    }

    // 2. Delete affiliates
    await adminClient.from('affiliates').delete().eq('user_id', userId)

    // 3. Get user's job IDs then delete variants
    const { data: jobs } = await adminClient
      .from('jobs')
      .select('id')
      .eq('user_id', userId)

    const jobIds = jobs?.map((j: { id: string }) => j.id) || []

    if (jobIds.length > 0) {
      await adminClient.from('variants').delete().in('job_id', jobIds)
    }

    // 4. Delete jobs
    await adminClient.from('jobs').delete().eq('user_id', userId)

    // 5. Delete payments
    await adminClient.from('payments').delete().eq('user_id', userId)

    // 6. Delete watermarks
    await adminClient.from('watermarks').delete().eq('user_id', userId)

    // 7. Delete events
    await adminClient.from('events').delete().eq('user_id', userId)

    // 8. Delete api_usage
    await adminClient.from('api_usage').delete().eq('user_id', userId)

    // 9. Delete storage files for user
    for (const bucket of ['videos', 'outputs', 'watermarks', 'images']) {
      const { data: files } = await adminClient.storage.from(bucket).list(userId)
      if (files && files.length > 0) {
        const filePaths = files.map((f: { name: string }) => `${userId}/${f.name}`)
        await adminClient.storage.from(bucket).remove(filePaths)
      }
    }

    // 10. Delete profile
    await adminClient.from('profiles').delete().eq('id', userId)

    // 11. Delete auth user
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)
    if (deleteError) {
      console.error('Error deleting auth user:', deleteError)
      return NextResponse.json({ error: 'Failed to delete auth user' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Account deletion error:', error)
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
  }
}
