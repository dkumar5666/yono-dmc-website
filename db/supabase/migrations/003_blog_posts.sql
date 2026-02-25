begin;

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text not null,
  content text not null,
  publish_date date not null,
  image_url text not null,
  category text not null,
  read_time text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_blog_posts_status_publish_date
  on public.blog_posts (status, publish_date desc, updated_at desc);

drop trigger if exists trg_blog_posts_updated_at on public.blog_posts;
create trigger trg_blog_posts_updated_at
before update on public.blog_posts
for each row execute function public.set_updated_at();

alter table public.blog_posts enable row level security;

drop policy if exists blog_posts_admin_all on public.blog_posts;
drop policy if exists blog_posts_public_published_select on public.blog_posts;

create policy blog_posts_admin_all
on public.blog_posts
for all
using (public.jwt_role() = 'admin')
with check (public.jwt_role() = 'admin');

create policy blog_posts_public_published_select
on public.blog_posts
for select
using (status = 'published');

commit;
