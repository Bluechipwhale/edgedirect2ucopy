-- Serialize clock-in with outlet deletion. Deletion must see a committed open visit; clock-in must see an active outlet. GPS distance, accuracy and permissions are unchanged.
create or replace function public.field_checkin(p_company uuid,p_assignment uuid,p_lat double precision,p_lng double precision,p_accuracy double precision,p_captured timestamptz)
returns uuid language plpgsql security definer set search_path=public as $$
declare c platform_companies;s field_stores;a field_assignments;vid uuid;distance double precision;radius integer;started boolean;
begin
 if company_role(p_company) is distinct from 'field_agent' or not field_enabled(p_company) then raise exception 'Forbidden';end if;
 select * into c from platform_companies where id=p_company;
 if not c.allow_web_checkin then raise exception 'Web check-in is disabled by company policy';end if;
 perform pg_advisory_xact_lock(hashtext(p_company::text),hashtext(auth.uid()::text));
 select * into a from field_assignments where company_id=p_company and id=p_assignment and agent_id=auth.uid() and visit_date=(now() at time zone 'Africa/Lagos')::date for update;
 if not found then raise exception 'Assigned store unavailable for today';end if;
 select * into s from field_stores where company_id=p_company and id=a.store_id and active for share;
 if not found or not coalesce(field_store_access(p_company,a.store_id),false) then raise exception 'Store unavailable or not assigned to you';end if;
 if s.latitude is null or s.longitude is null then raise exception 'Store location needs supervisor verification';end if;
 if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 or p_accuracy is null or p_accuracy not between 0 and 50 or p_captured is null or p_captured<now()-interval '60 seconds' or p_captured>now()+interval '5 seconds' then raise exception 'Fresh location with accuracy of 50 metres or better is required';end if;
 radius:=coalesce(s.radius_metres,c.geofence_metres);
 if p_company='10000000-0000-4000-8000-000000000001' then radius:=least(100,c.geofence_metres);end if;
 distance:=field_distance(p_lat,p_lng,s.latitude,s.longitude);
 if distance+p_accuracy>radius then raise exception 'You are % metres from the store with % metres GPS uncertainty. Move inside the % metre geofence and retry',round(distance)::integer,ceil(p_accuracy)::integer,radius;end if;
 -- Repeated requests still require valid GPS; they never create a second visit.
 select id into vid from field_visits where company_id=p_company and assignment_id=p_assignment;
 if found then return vid;end if;
 if exists(select 1 from field_visits where company_id=p_company and agent_id=auth.uid() and completed_at is null) then raise exception 'Complete the open visit first';end if;
 insert into field_shifts(company_id,agent_id,test_only) values(p_company,auth.uid(),s.is_test)
 on conflict(company_id,agent_id) where ended_at is null do nothing;
 started:=found;
 if not s.is_test then update field_shifts set test_only=false,started_at=now() where company_id=p_company and agent_id=auth.uid() and ended_at is null and test_only;end if;
 insert into field_visits(company_id,assignment_id,agent_id,latitude,longitude,accuracy_metres,captured_at,distance_metres)
 values(p_company,p_assignment,auth.uid(),p_lat,p_lng,p_accuracy,p_captured,distance) returning id into vid;
 if started then perform platform_log(p_company,'field.shift.in',jsonb_build_object('verified_visit',vid,'test',s.is_test));end if;
 perform platform_log(p_company,'field.checkin',jsonb_build_object('visit',vid,'radius_metres',radius,'test',s.is_test));
 return vid;
end $$;

