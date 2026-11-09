-- Charges a BAC paper and records the ledger entry on its attempt in one transaction, so a lost response or a crash
-- between the two can no longer leave a student charged with no refund path: either both happen (and the stale
-- sweep or the handler can refund the stored entry) or neither does.

create function public.bac_charge_attempt(p_attempt uuid, p_user uuid, p_amount int, p_target text)
returns table (entry_id bigint, balance int)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_entry bigint;
  v_balance int;
begin
  perform 1 from public.bac_attempts a
   where a.id = p_attempt and a.user_id = p_user and a.status = 'grading'
     for update;
  if not found then
    raise exception 'attempt_not_grading' using errcode = 'P0001';
  end if;

  -- spend_credits semantics: (null, balance) and nothing written when the balance is too low.
  select s.entry_id, s.balance into v_entry, v_balance
    from public.spend_credits(p_user, p_amount, null, p_target) s;

  if v_entry is not null then
    update public.bac_attempts set ledger_entry = v_entry where id = p_attempt;
  end if;

  entry_id := v_entry;
  balance := v_balance;
  return next;
end;
$$;
revoke execute on function public.bac_charge_attempt(uuid, uuid, int, text) from public, anon, authenticated;
grant execute on function public.bac_charge_attempt(uuid, uuid, int, text) to service_role;
