import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Fetch first variant thumbnail URLs for a batch of completed jobs.
 * Returns a Map of jobId -> signedUrl.
 */
export async function getJobThumbnails(
  supabase: SupabaseClient,
  jobIds: string[]
): Promise<Map<string, string>> {
  const thumbnailMap = new Map<string, string>()

  if (jobIds.length === 0) return thumbnailMap

  // Fetch first variant per job (one query)
  const { data: variants } = await supabase
    .from('variants')
    .select('job_id, file_path')
    .in('job_id', jobIds)
    .order('created_at', { ascending: true })

  if (!variants?.length) return thumbnailMap

  // Take first variant per job_id
  const firstVariantByJob = new Map<string, string>()
  for (const v of variants) {
    if (v.file_path && !firstVariantByJob.has(v.job_id)) {
      firstVariantByJob.set(v.job_id, v.file_path)
    }
  }

  // Batch signed URLs
  const paths = Array.from(firstVariantByJob.values())
  if (paths.length === 0) return thumbnailMap

  const { data: signedUrls } = await supabase.storage
    .from('outputs')
    .createSignedUrls(paths, 3600)

  if (!signedUrls) return thumbnailMap

  // Map paths back to job IDs
  const pathToUrl = new Map<string, string>()
  for (const entry of signedUrls) {
    if (entry.signedUrl && entry.path) {
      pathToUrl.set(entry.path, entry.signedUrl)
    }
  }

  for (const [jobId, filePath] of firstVariantByJob) {
    const url = pathToUrl.get(filePath)
    if (url) {
      thumbnailMap.set(jobId, url)
    }
  }

  return thumbnailMap
}
