CREATE POLICY "sim_purchase_lines_update" ON public.simulation_purchase_lines FOR UPDATE TO authenticated USING (public.can_write_simulation(simulation_id)) WITH CHECK (public.can_write_simulation(simulation_id));
CREATE POLICY "sim_tax_lines_update" ON public.simulation_tax_lines FOR UPDATE TO authenticated USING (public.can_write_simulation(simulation_id)) WITH CHECK (public.can_write_simulation(simulation_id));
CREATE POLICY "sim_sale_expenses_update" ON public.simulation_sale_expenses FOR UPDATE TO authenticated USING (public.can_write_simulation(simulation_id)) WITH CHECK (public.can_write_simulation(simulation_id));

REVOKE ALL ON FUNCTION public.bootstrap_grancont_admin() FROM PUBLIC, anon, authenticated;