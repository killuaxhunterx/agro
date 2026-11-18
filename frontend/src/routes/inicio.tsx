import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";

import { buttonClasses } from "#app/components/ui/button";
import { Card, Empty, SectionTitle } from "#app/components/ui/layout";
import { PageLoading } from "#app/components/ui/spinner";
import { AcaoItem, QueryError, VisitaItem } from "#app/routes/parts";
import { useUser } from "#app/routes/shell";
import { acoesQuery, visitasQuery } from "#app/services/api";
import { hojeISO } from "#app/utils/format";

/** A tela de abertura do representante: o que fazer hoje, o que ficou para trás. */
export function Inicio() {
  const u = useUser();
  const visitas = useQuery(visitasQuery({}));
  const acoes = useQuery(acoesQuery(true));
  const hoje = hojeISO();

  if (visitas.isPending || acoes.isPending) return <PageLoading />;
  if (visitas.error) return <QueryError error={visitas.error} />;
  if (acoes.error) return <QueryError error={acoes.error} />;

  const pendentes = visitas.data.filter((v) => !v.realizada_em);
  const semRegistro = pendentes.filter((v) => v.data.slice(0, 10) < hoje);
  const proximas = pendentes.filter((v) => v.data.slice(0, 10) >= hoje).sort((a, b) => a.data.localeCompare(b.data));
  const recentes = visitas.data.filter((v) => v.realizada_em).slice(0, 4);

  return (
    <>
      <div className="mb-6">
        <p className="text-sm text-muted">Olá, {u.nome.split(" ")[0]}.</p>
        <h1 className="text-2xl font-extrabold text-brand sm:text-3xl">Seu dia no campo</h1>
      </div>

      <div className="mb-6 flex">
        <Link to="/visitas/nova" className={buttonClasses("primary")}>
          + Planejar visita
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-6">
          {semRegistro.length > 0 ? (
            <Card className="border-danger/40">
              <SectionTitle>Visitas sem registro</SectionTitle>
              <p className="mb-3 text-sm text-muted">
                A data passou e ainda não há o registro do que aconteceu. Lembre: o reembolso
                depende do relatório em até 3 dias.
              </p>
              <ul className="flex flex-col gap-2">
                {semRegistro.map((v) => (
                  <VisitaItem key={v.id} v={v} />
                ))}
              </ul>
            </Card>
          ) : null}

          <Card>
            <SectionTitle>Próximas visitas</SectionTitle>
            {proximas.length === 0 ? (
              <Empty title="Nenhuma visita planejada.">Planeje a próxima: motivo, pauta e o que precisa levar.</Empty>
            ) : (
              <ul className="flex flex-col gap-2">
                {proximas.map((v) => (
                  <VisitaItem key={v.id} v={v} />
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <SectionTitle aside={<Link to="/pendencias" className="text-sm font-bold text-brand">Ver todas</Link>}>
              Pendências em aberto
            </SectionTitle>
            {acoes.data.length === 0 ? (
              <Empty title="Nenhuma pendência em aberto." />
            ) : (
              <ul className="flex flex-col gap-2">
                {acoes.data.slice(0, 6).map((a) => (
                  <AcaoItem key={a.id} a={a} canEdit />
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <SectionTitle aside={<Link to="/visitas" className="text-sm font-bold text-brand">Histórico</Link>}>
              Últimas realizadas
            </SectionTitle>
            {recentes.length === 0 ? (
              <Empty title="Nenhuma visita realizada ainda." />
            ) : (
              <ul className="flex flex-col gap-2">
                {recentes.map((v) => (
                  <VisitaItem key={v.id} v={v} />
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
