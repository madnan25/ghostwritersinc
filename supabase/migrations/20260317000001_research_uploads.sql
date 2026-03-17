-- Research uploads table for WhatsApp chat exports and other research materials
create table research_uploads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  uploaded_by uuid references auth.users(id),
  filename text not null,
  storage_path text not null,
  upload_type text not null default 'whatsapp_chat',
  file_size_bytes bigint,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

alter table research_uploads enable row level security;

create policy "Users can view their org uploads"
  on research_uploads for select
  using (organization_id = user_organization_id());

create policy "Users can insert uploads for their org"
  on research_uploads for insert
  with check (organization_id = user_organization_id());

create policy "Users can delete their own uploads"
  on research_uploads for delete
  using (organization_id = user_organization_id() and uploaded_by = auth.uid());

-- Create storage bucket for research files
insert into storage.buckets (id, name, public)
values ('research', 'research', false)
on conflict (id) do nothing;

-- Storage policies
create policy "Authenticated users can upload research files"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'research');

create policy "Users can read research files from their bucket"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'research');
