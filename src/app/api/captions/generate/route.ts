import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

const STYLES: Record<string, string> = {
  mixed:
    'Vary your storytelling techniques across slides — use confessions, reveals, cliffhangers, and emotional turns.',
  drama:
    'Tell an emotional, dramatic story — relationship conflicts, shocking confessions, betrayals, or life-changing moments. Build emotional intensity slide by slide.',
  listicle:
    'Structure as a progressive reveal — "3 things that happened..." or "what nobody tells you about being a {niche}..." where each slide reveals the next point, building to the most shocking.',
  hottake:
    'Build a controversial take across slides — start with a spicy opinion, back it up with personal experience, and end with a take so hot it forces comments.',
  cliffhanger:
    'Maximize suspense — every slide must end mid-thought or with an incomplete reveal. Use "..." liberally. The viewer must swipe to find out what happens next.',
}

const SYSTEM_PROMPT = `You are a viral social media storyline writer for TikTok carousels, Instagram Stories, and multi-slide posts.

Your job: Create a {count}-part STORYLINE for a {niche} creator. Each part is one slide caption.

STORY ARC STRUCTURE:
- Slide 1: Irresistible hook that makes viewers swipe to the next slide
- Middle slides: Build tension, reveal details, or escalate the situation
- Final slide: Deliver the payoff, plot twist, or call-to-action

NICHE PERSONA: {niche}
STYLE: {style_instruction}

RULES — follow these strictly:
- The captions form ONE continuous story arc, not independent posts
- Each caption is 1-3 sentences (they go ON photos as text overlays)
- UNDER 20 words per caption, max 30 absolute limit
- Casual lowercase tone — use abbreviations like "bcus", "tbh", "ngl", "imo", "rn", "lowkey"
- Sparse emoji — 0 to 2 max per caption, most captions should have zero
- Must sound like a REAL PERSON typed it, NOT like AI or a brand
- Written in first person as the {niche} persona
- Every slide must make the viewer NEED to see the next one
- Make it feel authentic and relatable, not scripted
- No hashtags, no @mentions, no links
- No quotation marks around the captions

OUTPUT FORMAT:
Return ONLY the captions, one per line. No numbering, no bullets, no extra text.`

const MAX_CAPTIONS = 50
const VALID_STYLES = Object.keys(STYLES)

export async function POST(request: Request) {
  try {
    // Support both JSON and FormData (frontend sends FormData when including an image)
    let niche: string | undefined
    let count: number | undefined
    let style: string = 'mixed'
    let imageBase64: string | undefined

    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      niche = formData.get('niche') as string | undefined
      count = parseInt(formData.get('count') as string) || undefined
      style = (formData.get('style') as string) || 'mixed'

      const imageFile = formData.get('image') as File | null
      if (imageFile) {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
        if (!allowedTypes.includes(imageFile.type)) {
          return NextResponse.json({ error: 'Invalid image type. Use JPG, PNG, or WebP.' }, { status: 400 })
        }
        const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB
        if (imageFile.size > MAX_IMAGE_SIZE) {
          return NextResponse.json({ error: 'Image exceeds 10MB size limit.' }, { status: 400 })
        }
        const buffer = await imageFile.arrayBuffer()
        const base64 = Buffer.from(buffer).toString('base64')
        imageBase64 = `data:${imageFile.type};base64,${base64}`
      }
    } else {
      const body = await request.json()
      niche = body.niche
      count = body.count
      style = body.style || 'mixed'
    }

    // Validate required fields
    if (!niche || typeof niche !== 'string' || niche.trim().length === 0) {
      return NextResponse.json(
        { error: 'Niche is required' },
        { status: 400 }
      )
    }

    if (!count || typeof count !== 'number' || count < 1) {
      return NextResponse.json(
        { error: 'Count must be at least 1' },
        { status: 400 }
      )
    }

    if (count > MAX_CAPTIONS) {
      return NextResponse.json(
        { error: `Count cannot exceed ${MAX_CAPTIONS}` },
        { status: 400 }
      )
    }

    if (!VALID_STYLES.includes(style)) {
      return NextResponse.json(
        { error: `Invalid style. Choose from: ${VALID_STYLES.join(', ')}` },
        { status: 400 }
      )
    }

    // Verify the user is authenticated
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check for OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.error('OPENAI_API_KEY not configured')
      return NextResponse.json(
        { error: 'AI caption generation is not configured' },
        { status: 500 }
      )
    }

    const client = new OpenAI({ apiKey })
    const styleInstruction = STYLES[style]
    const systemMsg = SYSTEM_PROMPT
      .replace(/\{niche\}/g, niche.trim())
      .replace('{style_instruction}', styleInstruction)
      .replace(/\{count\}/g, String(count))

    // Storyline captions must be generated in a single request to maintain narrative
    // continuity. MAX_PHOTOS is 20 which is well under BATCH_SIZE (50), so all
    // captions will always fit in one batch.
    const userMsg = `Write a ${count}-slide storyline for a ${niche.trim()} creator. Each line is one slide's caption. The story must flow from hook to payoff.`

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemMsg },
    ]

    // If image is provided, use vision mode for image-aware storyline
    if (imageBase64) {
      messages.push({
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Look at this photo of a ${niche.trim()} creator. Write a ${count}-slide storyline inspired by what you see. Each line is one slide's caption. The story must flow from hook to payoff.`,
          },
          {
            type: 'image_url',
            image_url: { url: imageBase64 },
          },
        ],
      })
    } else {
      messages.push({ role: 'user', content: userMsg })
    }

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 1.0,
      max_tokens: 2048,
    })

    const text = response.choices[0]?.message?.content || ''
    const allCaptions = text
      .trim()
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    // Trim to exact count requested
    const captions = allCaptions.slice(0, count)

    return NextResponse.json({ captions })
  } catch (error) {
    console.error('Caption generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate captions' },
      { status: 500 }
    )
  }
}
