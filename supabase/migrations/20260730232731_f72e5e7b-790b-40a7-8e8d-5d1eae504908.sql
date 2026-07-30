GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulation_purchase_lines TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulation_tax_lines TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulation_sale_expenses TO authenticated;
GRANT ALL ON public.simulation_purchase_lines TO service_role;
GRANT ALL ON public.simulation_tax_lines TO service_role;
GRANT ALL ON public.simulation_sale_expenses TO service_role;