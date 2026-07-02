-- Migration 026: Post-Dated Cheque (PDC) tracking.
-- Tracks both Payable (cheques the company issues) and Receivable (cheques the
-- company receives) post-dated cheques, with due date, party, amount and a
-- clearing status. Surfaced under the Documents area.

CREATE TABLE IF NOT EXISTS public.pdc_cheques (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id     uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cheque_type    varchar NOT NULL CHECK (cheque_type IN ('payable', 'receivable')),
  cheque_number  varchar NOT NULL,
  bank_name      varchar,
  amount         numeric(14,2) NOT NULL DEFAULT 0,
  currency       varchar(3) DEFAULT 'AED',
  cheque_date    date NOT NULL,                       -- the post-dated / due date
  party_name     varchar,                             -- payee (payable) / drawer (receivable)
  reference      varchar,                             -- linked invoice / PO / contract ref
  status         varchar NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'cleared', 'bounced', 'cancelled')),
  notes          text,
  created_by     uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at     timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at     timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pdc_cheques_company_type   ON public.pdc_cheques (company_id, cheque_type);
CREATE INDEX IF NOT EXISTS idx_pdc_cheques_company_status ON public.pdc_cheques (company_id, status);
CREATE INDEX IF NOT EXISTS idx_pdc_cheques_due            ON public.pdc_cheques (cheque_date);

ALTER TABLE public.pdc_cheques ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pdc_cheques_read   ON public.pdc_cheques;
DROP POLICY IF EXISTS pdc_cheques_insert ON public.pdc_cheques;
DROP POLICY IF EXISTS pdc_cheques_update ON public.pdc_cheques;
DROP POLICY IF EXISTS pdc_cheques_delete ON public.pdc_cheques;

-- Anyone with company access can view; HR Manager or above can manage.
CREATE POLICY pdc_cheques_read ON public.pdc_cheques
  FOR SELECT TO public
  USING (((select auth.uid()) IS NOT NULL) AND (public.is_super_admin() OR public.user_has_company_access(company_id)));

CREATE POLICY pdc_cheques_insert ON public.pdc_cheques
  FOR INSERT TO public
  WITH CHECK (((select auth.uid()) IS NOT NULL) AND (public.is_super_admin() OR (public.is_hr_or_above() AND public.user_has_company_access(company_id))));

CREATE POLICY pdc_cheques_update ON public.pdc_cheques
  FOR UPDATE TO public
  USING (((select auth.uid()) IS NOT NULL) AND (public.is_super_admin() OR (public.is_hr_or_above() AND public.user_has_company_access(company_id))))
  WITH CHECK (((select auth.uid()) IS NOT NULL) AND (public.is_super_admin() OR (public.is_hr_or_above() AND public.user_has_company_access(company_id))));

CREATE POLICY pdc_cheques_delete ON public.pdc_cheques
  FOR DELETE TO public
  USING (((select auth.uid()) IS NOT NULL) AND (public.is_super_admin() OR (public.is_company_admin_or_above() AND public.user_has_company_access(company_id))));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdc_cheques TO authenticated;
GRANT ALL ON public.pdc_cheques TO service_role;
