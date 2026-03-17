import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { UploadList } from './_components/upload-list'
import { WhatsAppInstructions } from './_components/whatsapp-instructions'

export default async function ResearchPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="container px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Research</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload WhatsApp chat exports and other research materials for content mining.
        </p>
      </div>

      <div className="mx-auto max-w-2xl space-y-6">
        <WhatsAppInstructions />
        <UploadList />
      </div>
    </div>
  )
}
