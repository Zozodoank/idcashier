create table if not exists public.attendance_machines (
    id uuid not null default gen_random_uuid(),
    user_id uuid references auth.users(id),
    tenant_id uuid references auth.users(id),
    name text not null,
    ip_address text,
    port text default '4370',
    status text default 'active',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint attendance_machines_pkey primary key (id)
);

-- RLS Policies
alter table public.attendance_machines enable row level security;

create policy "Users can view attendance machines in their tenant" on public.attendance_machines
    for select using (
        auth.uid() = tenant_id or 
        exists (
            select 1 from public.users 
            where users.id = auth.uid() and users.tenant_id = attendance_machines.tenant_id
        )
    );

create policy "Users can insert attendance machines in their tenant" on public.attendance_machines
    for insert with check (
        auth.uid() = tenant_id or 
        exists (
            select 1 from public.users 
            where users.id = auth.uid() and users.tenant_id = attendance_machines.tenant_id
        )
    );

create policy "Users can update attendance machines in their tenant" on public.attendance_machines
    for update using (
        auth.uid() = tenant_id or 
        exists (
            select 1 from public.users 
            where users.id = auth.uid() and users.tenant_id = attendance_machines.tenant_id
        )
    );

create policy "Users can delete attendance machines in their tenant" on public.attendance_machines
    for delete using (
        auth.uid() = tenant_id or 
        exists (
            select 1 from public.users 
            where users.id = auth.uid() and users.tenant_id = attendance_machines.tenant_id
        )
    );

-- Grant permissions
grant all on table public.attendance_machines to authenticated;
grant all on table public.attendance_machines to service_role;
