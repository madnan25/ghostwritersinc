'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function approvePost(postId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('posts')
    .update({ status: 'approved', updated_at: new Date().toISOString() })
    .eq('id', postId)

  if (error) throw new Error(error.message)

  await supabase.from('review_events').insert({
    post_id: postId,
    agent_name: 'client',
    action: 'approved',
    notes: null,
  })

  revalidatePath('/dashboard')
  revalidatePath(`/post/${postId}`)
}

export async function rejectPost(postId: string, reason: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('posts')
    .update({
      status: 'rejected',
      rejection_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', postId)

  if (error) throw new Error(error.message)

  await supabase.from('review_events').insert({
    post_id: postId,
    agent_name: 'client',
    action: 'rejected',
    notes: reason,
  })

  revalidatePath('/dashboard')
  revalidatePath(`/post/${postId}`)
}
