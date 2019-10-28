create or replace function f_create_user ( pv_username name
                                         , pv_password text
                                         ) returns boolean
as $$
declare
  lb_return boolean := true;
  ln_count integer;
begin
  if ( pv_username is null )
  then
     raise warning 'Username must not be null';
     lb_return := false;
  end if;
  if ( pv_password is null )
  then
     raise warning 'Password must not be null';
     lb_return := false;
  end if;
  -- test if the user already exists
  begin
      select count(*)
        into ln_count
        from pg_user
       where usename = pv_username;
  exception
      when no_data_found then
          -- ok, no user with this name is defined
          null;
      when too_many_rows then
          -- this should really never happen
          raise exception 'You have a huge issue in your catalog';
  end;
  if ( ln_count > 0 )
  then
     raise warning 'The user "%" already exist', pv_username;
     lb_return := false;
  else
      execute 'create user '||pv_username||' with password '||''''||'pv_password'||'''';
  end if;
  return lb_return;
end;
$$ language plpgsql;