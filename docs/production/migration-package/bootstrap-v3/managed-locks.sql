-- Migration window only. Known synthetic project; no application/provider ledger writes.
-- Block competing Auth/Storage data writers while the planned DDL transaction runs.
-- Exact ordinary Auth/Storage writer surface. Provider vector/analytics internals
-- and managed ledgers are excluded; no new privileges are requested.
LOCK TABLE auth.users,auth.identities,auth.sessions,auth.refresh_tokens,
 auth.mfa_factors,auth.mfa_challenges,auth.mfa_amr_claims,auth.audit_log_entries,
 storage.buckets,storage.objects IN SHARE ROW EXCLUSIVE MODE;
