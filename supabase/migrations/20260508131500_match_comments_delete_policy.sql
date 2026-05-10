grant delete on public.match_comments to authenticated;

drop policy if exists "Players can delete their own comments and admins can delete any" on public.match_comments;
create policy "Players can delete their own comments and admins can delete any"
on public.match_comments
for delete
to authenticated
using (
  user_id = auth.uid()
  or public.is_current_user_admin()
);
