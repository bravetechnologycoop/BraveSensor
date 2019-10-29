DROP FUNCTION IF EXISTS f_create_user(text,text);


create or replace function f_create_user (_username name, _password text) 
returns boolean as $setup$
  declare
  lb_return boolean := true;
  ln_count integer;
begin
  if (_username is null )
  then
     raise warning 'Username must not be null';
     lb_return := false;
  end if;
  if (_password is null )
  then
     raise warning 'Password must not be null';
     lb_return := false;
  end if;
  -- test if the user already exists
  begin
      select count(*)
        into ln_count
        from pg_user
       where usename = _username;
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
     raise warning 'The user "%" already exist', _username;
     lb_return := false;
  else
      execute 'create user '||_username||' with password '||''''||'_password'||'''';
  end if;
  return lb_return;
end $setup$ language plpgsql;

SELECT f_create_user(:username, :password);