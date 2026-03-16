import { createClient } from '@/lib/supabase/server'
import type { Post, PostComment, ReviewEvent } from '@/lib/types'

export async function getPendingReviewPosts(): Promise<Post[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('status', 'pending_review')
    .order('suggested_publish_at', { ascending: true })

  if (error) {
    console.error('Error fetching pending review posts:', error)
    return []
  }
  return data ?? []
}

export async function getPostById(id: string): Promise<Post | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching post:', error)
    return null
  }
  return data
}

export async function getPostReviewEvents(postId: string): Promise<ReviewEvent[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('review_events')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching review events:', error)
    return []
  }
  return data ?? []
}

export async function getAllPosts(): Promise<Post[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .order('suggested_publish_at', { ascending: true })

  if (error) {
    console.error('Error fetching all posts:', error)
    return []
  }
  return data ?? []
}

export async function getPostComments(postId: string): Promise<PostComment[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('post_comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching post comments:', error)
    return []
  }
  return data ?? []
}
