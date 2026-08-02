create or replace function public.quick_create_linkup(p_title text)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid:=auth.uid();
  v_title text:=btrim(coalesce(p_title,''));
  v_area text;
  v_category text;
begin
  if char_length(v_title) not between 3 and 100 then
    raise exception 'Add a title with between 3 and 100 characters.';
  end if;

  select coalesce(nullif(btrim(p.area),''),'Local area')
  into v_area
  from public.profiles p
  where p.id=v_user and p.account_type='explorer';

  if v_area is null then
    raise exception 'Only Explorer accounts can create Link-ups.';
  end if;

  v_category:=case
    when lower(v_title) like '%football%' then 'Football'
    when lower(v_title) like '%walk%' then 'Walking'
    when lower(v_title) like '%run%' then 'Running'
    when lower(v_title) like '%coffee%' then 'Coffee'
    when lower(v_title) similar to '%(food|lunch|dinner)%' then 'Food'
    when lower(v_title) similar to '%(game|quiz)%' then 'Games'
    else 'Social'
  end;

  return public.create_linkup(
    p_title=>v_title,
    p_description=>'Details will be added by the organiser.',
    p_category=>v_category,
    p_starts_at=>now()+interval '1 day',
    p_ends_at=>now()+interval '1 day 2 hours',
    p_area=>v_area,
    p_location_name=>'Public meeting place to be confirmed',
    p_meeting_point_details=>'',
    p_latitude=>null,
    p_longitude=>null,
    p_max_attendees=>8,
    p_visibility=>'public'
  );
end;
$$;

revoke all on function public.quick_create_linkup(text) from public,anon;
grant execute on function public.quick_create_linkup(text) to authenticated;
