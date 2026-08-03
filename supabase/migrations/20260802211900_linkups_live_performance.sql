create index if not exists linkup_messages_user_created_idx on public.linkup_messages(user_id,created_at desc);

create or replace function public.refresh_live_system()
returns jsonb language plpgsql security definer set search_path=public,private as $$
declare v_completed integer; v_expired integer; v_reminders integer; v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  if not private.linkup_user_is_explorer(v_user) then
    return jsonb_build_object('completed',0,'expired_checkins',0,'reminders',0);
  end if;
  update public.linkups set status='completed' where status in ('upcoming','full') and ends_at<=now();
  get diagnostics v_completed=row_count;
  update public.live_checkins set status='expired',ended_at=now() where status='active' and expires_at<=now();
  get diagnostics v_expired=row_count;
  insert into public.notifications(recipient_user_id,actor_user_id,type,title,message,entity_type,entity_id,deep_link,data,dedupe_key)
  select a.user_id,l.creator_id,'linkup_reminder','Link-up starting soon',l.title,'linkup',l.id,'/linkups/'||l.id,
    jsonb_build_object('linkup_id',l.id),'linkup-reminder-'||l.id||'-'||a.user_id
  from public.linkups l join public.linkup_attendees a on a.linkup_id=l.id and a.status='joined'
  where l.status in ('upcoming','full') and l.starts_at>now() and l.starts_at<=now()+interval '2 hours'
    and not exists(select 1 from public.notifications n where n.dedupe_key='linkup-reminder-'||l.id||'-'||a.user_id);
  get diagnostics v_reminders=row_count;
  return jsonb_build_object('completed',v_completed,'expired_checkins',v_expired,'reminders',v_reminders);
end;
$$;
