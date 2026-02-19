import { SupabaseClient } from '@supabase/supabase-js'
import JSZip from 'jszip'
import type { Job } from '@/lib/supabase/types'

/**
 * Download all variant files for a completed job as a ZIP.
 * Tries the pre-built ZIP first, falls back to building one client-side.
 */
export async function downloadJobFiles(
  supabase: SupabaseClient,
  profileId: string,
  job: Job
): Promise<void> {
  // Try pre-built ZIP first
  if (job.output_zip_path) {
    const { data } = await supabase.storage
      .from('outputs')
      .createSignedUrl(job.output_zip_path, 3600)

    if (data?.signedUrl) {
      const a = document.createElement('a')
      a.href = data.signedUrl
      a.download = `${job.source_file_name || 'variants'}_variants.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      return
    }
  }

  // Fallback: build ZIP client-side from individual variant files
  const { data: files } = await supabase.storage
    .from('outputs')
    .list(`${profileId}/${job.id}`, { sortBy: { column: 'name', order: 'asc' } })

  if (!files?.length) {
    throw new Error('No output files found for this job.')
  }

  // Filter out the ZIP file itself
  const variantFiles = files.filter((f) => !f.name.endsWith('.zip'))
  if (!variantFiles.length) {
    throw new Error('No variant files found for this job.')
  }

  const zip = new JSZip()
  for (const file of variantFiles) {
    const { data } = await supabase.storage
      .from('outputs')
      .download(`${profileId}/${job.id}/${file.name}`)
    if (data) {
      zip.file(file.name, data)
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${(job.source_file_name || 'variants').replace(/\.[^.]+$/, '')}_variants.zip`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
