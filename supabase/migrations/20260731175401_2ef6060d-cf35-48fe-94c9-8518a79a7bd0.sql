CREATE TABLE public.app_analytics_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users ON DELETE CASCADE,
  sessao_id TEXT NOT NULL,
  evento TEXT NOT NULL,
  modo TEXT,
  caminho TEXT,
  parametros JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_app_analytics_events_created_at ON public.app_analytics_events (created_at DESC);
CREATE INDEX idx_app_analytics_events_evento ON public.app_analytics_events (evento, created_at DESC);

GRANT SELECT, INSERT ON public.app_analytics_events TO authenticated;
GRANT ALL ON public.app_analytics_events TO service_role;

ALTER TABLE public.app_analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario registra seus proprios eventos"
  ON public.app_analytics_events FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Administradores gerais consultam eventos"
  ON public.app_analytics_events FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.is_grancont_admin());

CREATE OR REPLACE FUNCTION public.metricas_precificacao(_dias INTEGER DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inicio TIMESTAMPTZ;
  _res JSONB;
BEGIN
  IF NOT (public.is_super_admin() OR public.is_grancont_admin()) THEN
    RAISE EXCEPTION 'Acesso restrito a administradores gerais';
  END IF;

  _dias := LEAST(GREATEST(COALESCE(_dias, 30), 1), 365);
  _inicio := now() - (_dias || ' days')::interval;

  SELECT jsonb_build_object(
    'dias', _dias,
    'inicio', _inicio,
    'sessoes', (SELECT COUNT(DISTINCT sessao_id) FROM app_analytics_events WHERE created_at >= _inicio),
    'usuarios', (SELECT COUNT(DISTINCT user_id) FROM app_analytics_events WHERE created_at >= _inicio),
    'eventos_total', (SELECT COUNT(*) FROM app_analytics_events WHERE created_at >= _inicio),
    'simulacoes_salvas', (SELECT COUNT(*) FROM simulations WHERE created_at >= _inicio),
    'por_evento', COALESCE((
      SELECT jsonb_agg(x ORDER BY (x->>'total')::int DESC) FROM (
        SELECT jsonb_build_object(
          'evento', evento,
          'total', COUNT(*)::int,
          'sessoes', COUNT(DISTINCT sessao_id)::int,
          'usuarios', COUNT(DISTINCT user_id)::int
        ) AS x
        FROM app_analytics_events
        WHERE created_at >= _inicio
        GROUP BY evento
      ) e
    ), '[]'::jsonb),
    'por_modo', COALESCE((
      SELECT jsonb_agg(x) FROM (
        SELECT jsonb_build_object('modo', COALESCE(modo, 'nao_informado'), 'total', COUNT(*)::int) AS x
        FROM app_analytics_events
        WHERE created_at >= _inicio
        GROUP BY COALESCE(modo, 'nao_informado')
      ) m
    ), '[]'::jsonb),
    'serie', COALESCE((
      SELECT jsonb_agg(x ORDER BY x->>'dia') FROM (
        SELECT jsonb_build_object(
          'dia', to_char(date_trunc('day', created_at), 'YYYY-MM-DD'),
          'sessoes', COUNT(DISTINCT sessao_id)::int,
          'usuarios', COUNT(DISTINCT user_id)::int,
          'iniciadas', COUNT(*) FILTER (WHERE evento = 'simulacao_iniciada')::int,
          'concluidas', COUNT(*) FILTER (WHERE evento = 'simulacao_concluida')::int,
          'exportacoes', COUNT(*) FILTER (WHERE evento = 'exportar_relatorio')::int
        ) AS x
        FROM app_analytics_events
        WHERE created_at >= _inicio
        GROUP BY date_trunc('day', created_at)
      ) s
    ), '[]'::jsonb)
  ) INTO _res;

  RETURN _res;
END;
$$;

REVOKE ALL ON FUNCTION public.metricas_precificacao(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.metricas_precificacao(INTEGER) TO authenticated, service_role;