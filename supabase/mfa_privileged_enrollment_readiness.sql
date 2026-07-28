-- Read-only SEC-003 activation preflight.
-- Returns aggregate counts only. It never returns account identifiers.

with privileged_factor_readiness as (
  select
    profile.id,
    count(factor.id) filter (
      where factor.status = 'verified'
        and factor.factor_type = 'totp'
    ) as verified_totp_factors
  from public.profiles as profile
  left join auth.mfa_factors as factor
    on factor.user_id = profile.id
  where profile.app_role in ('support', 'compliance', 'admin')
  group by profile.id
)
select
  count(*)::integer as privileged_accounts,
  count(*) filter (where verified_totp_factors >= 2)::integer
    as rollout_ready_accounts,
  count(*) filter (where verified_totp_factors < 2)::integer
    as rollout_blocked_accounts,
  case
    when count(*) = count(*) filter (where verified_totp_factors >= 2)
      then 'ready'
    else 'blocked'
  end as activation_state
from privileged_factor_readiness;

