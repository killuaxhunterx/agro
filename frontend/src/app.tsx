import { Navigate, Route, Routes } from "react-router";

import { Toaster } from "#app/components/ui/toast";
import { RequireAuth, useUser } from "#app/routes/shell";
import { Entrar } from "#app/routes/auth/entrar";
import { Conta } from "#app/routes/conta";
import { Inicio } from "#app/routes/inicio";
import { ClientesLista } from "#app/routes/clientes/lista";
import { ClienteForm } from "#app/routes/clientes/form";
import { ClienteDetalhe } from "#app/routes/clientes/detalhe";
import { VisitasLista } from "#app/routes/visitas/lista";
import { VisitaPlanejar } from "#app/routes/visitas/planejar";
import { VisitaDetalhe } from "#app/routes/visitas/detalhe";
import { Pendencias } from "#app/routes/pendencias";
import { PainelPage } from "#app/routes/painel";
import { FeedbackNovo, FeedbackPage, FeedbacksLista } from "#app/routes/feedbacks";
import { Empresas } from "#app/routes/master/empresas";
import { EmpresaPage } from "#app/routes/master/empresa";

function Home() {
  const u = useUser();
  if (u.papel === "master") return <Navigate to="/empresas" replace />;
  if (u.papel === "gestor") return <Navigate to="/painel" replace />;
  return <Inicio />;
}

export function App() {
  return (
    <>
      <Routes>
        <Route path="/entrar" element={<Entrar />} />
        <Route element={<RequireAuth />}>
          <Route index element={<Home />} />
          <Route path="conta" element={<Conta />} />
          <Route path="painel" element={<PainelPage />} />
          <Route path="clientes" element={<ClientesLista />} />
          <Route path="clientes/novo" element={<ClienteForm />} />
          <Route path="clientes/:id" element={<ClienteDetalhe />} />
          <Route path="clientes/:id/editar" element={<ClienteForm />} />
          <Route path="visitas" element={<VisitasLista />} />
          <Route path="visitas/nova" element={<VisitaPlanejar />} />
          <Route path="visitas/:id" element={<VisitaDetalhe />} />
          <Route path="visitas/:id/planejamento" element={<VisitaPlanejar />} />
          <Route path="pendencias" element={<Pendencias />} />
          <Route path="feedbacks" element={<FeedbacksLista />} />
          <Route path="feedbacks/novo" element={<FeedbackNovo />} />
          <Route path="feedbacks/:id" element={<FeedbackPage />} />
          <Route path="empresas" element={<Empresas />} />
          <Route path="empresas/:id" element={<EmpresaPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <Toaster />
    </>
  );
}
