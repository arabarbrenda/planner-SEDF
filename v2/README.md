# Planner da Bre V2

A nova aplicação está sendo construída separadamente da V1, dentro de `v2/`. A raiz do repositório e o site publicado não são substituídos por esta etapa.

## Stack
- React 18 + TypeScript
- Vite
- Supabase JS v2
- Supabase Auth (Google OAuth e e-mail/senha)
- PostgreSQL com Row Level Security

## Executar localmente

1. Instale Node.js LTS.
2. No terminal, entre na pasta `v2`.
3. Instale as dependências: `npm install`.
4. Copie `.env.example` para `.env.local`.
5. Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` com os valores públicos do projeto Supabase.
6. Execute `npm run dev`.

Não coloque `service_role`, secret keys ou senha do banco em variáveis `VITE_*`, pois elas são incorporadas ao bundle do navegador.

## Configuração necessária no Supabase

Antes de testar autenticação:
- Configure Authentication > URL Configuration com a URL local (por exemplo, `http://localhost:5173`) e a URL definitiva de produção quando ela existir.
- Habilite o provedor Google em Authentication > Sign In / Providers e configure as credenciais OAuth do Google.
- Revise a configuração de confirmação de e-mail.
- Configure o endereço de redirecionamento de recuperação de senha.
- Aplique, em ordem, as migrations `../supabase/migrations/0001_initial_schema.sql` e `../supabase/migrations/0002_atomic_legacy_import.sql` somente após revisão e em um projeto de desenvolvimento isolado.

A criação do projeto Supabase não configura automaticamente o provedor Google. O botão Google só funcionará depois dessa configuração.

## Estado atual

- [x] Estrutura inicial React/TypeScript/Vite em `v2/`
- [x] Cliente Supabase tipado por variáveis de ambiente
- [x] Tela inicial de login Google e e-mail/senha
- [x] Cadastro por e-mail e recuperação de senha
- [x] Tela de definição de nova senha para o fluxo de recuperação
- [x] Esqueleto do app autenticado
- [x] Primeira migration SQL e documentação de arquitetura
- [x] Validar TypeScript e build de produção pelo GitHub Actions
- [ ] Validar as duas migrations no banco de desenvolvimento
- [ ] Configurar e testar Google OAuth e e-mail
- [x] Criar serviços Supabase para disciplinas, assuntos, sessões e tentativas de questões
- [x] Implementar dashboard com métricas, cadastro de disciplinas/assuntos e alteração de status
- [x] Implementar registro manual de tempo de estudo e desempenho em questões
- [x] Implementar planejamento semanal por dia, disciplina, assunto, horário e duração
- [x] Exibir carga horária semanal e permitir remover blocos de estudo
- [x] Implementar registro e histórico de simulados com banca, data, duração e distribuição de acertos/erros/em branco
- [x] Implementar caderno de erros com vínculo a disciplina/assunto, respostas, explicação, etiquetas e status
- [x] Implementar biblioteca de jurisprudência com tribunal, referência, data, resumo e link da fonte
- [x] Adicionar pesquisa textual e filtro por status no caderno de erros
- [x] Adicionar pesquisa textual na biblioteca de jurisprudência e no histórico de simulados
- [x] Implementar leitura, prévia, validação básica e importação do backup JSON exportado pela V1
- [x] Exportar backup JSON completo da V2 com paginação, incluindo configurações e registros de estudo, questões, revisões, planejamento, simulados, caderno de erros e jurisprudência
- [x] Restaurar backup JSON da V2 por função PostgreSQL transacional, preservando IDs e vínculos e atribuindo os registros ao usuário autenticado
- [x] Validar as 11 seções obrigatórias do backup V2 e apresentar prévia da quantidade de registros antes da confirmação da restauração
- [x] Testar restauração, idempotência por ID, isolamento do usuário e rollback integral em PostgreSQL 15 temporário no CI, inclusive em conflito com a regra de um único plano ativo por usuário
- [x] Criar serviços de agendamento, listagem e conclusão de revisões
- [x] Adicionar painel de revisões programadas, atrasadas e concluídas
- [x] Teste de integração da migration em PostgreSQL 15 temporário no CI (aplicação da migration, integridade referencial, unicidade do planejamento e isolamento RLS)\n- [x] Agregação das métricas do dashboard no PostgreSQL, respeitando RLS e sem limite de paginação do cliente\n- [x] Testes automatizados dos fluxos de login, cadastro, recuperação de senha, erros de autenticação e início do Google OAuth
- [x] Testes automatizados de integração para importação V1 transacional, isolamento entre contas, bloqueio de acesso anônimo e rollback integral
- [ ] Testes automatizados adicionais dos fluxos completos

## Limitações conhecidas nesta etapa

- O dashboard registra sessões e tentativas manualmente; ainda não há importador real do Tec Concursos.
- A V2 permite exportar e restaurar backup JSON completo. A restauração é aditiva: IDs já existentes são ignorados, novos registros são inseridos e conflitos de integridade fazem a transação inteira falhar. Ela ainda não foi validada contra o projeto Supabase hospedado; mantenha cópias independentes dos arquivos de backup.
- O importador da V1 aceita o backup JSON e adiciona disciplinas, assuntos, sessões, totais de questões por assunto, simulados e registros de jurisprudência reconhecidos. Não migra planejamento/ciclo, tema visual ou arquivos anexados. A importação é aditiva e transacional, executada pela função `import_legacy_v1_backup`: em caso de falha, os registros de dados são revertidos integralmente e a tentativa fica registrada como `failed`, permitindo nova tentativa com o mesmo fingerprint. Cada backup é identificado por SHA-256 e registrado em `import_jobs`; uma importação concluída ou em andamento bloqueia a repetição automática do mesmo conteúdo. A função exige usuário autenticado, atribui os registros ao usuário da sessão e opera sob RLS.
- O módulo de revisões já permite agendamento, identificação de atrasos e registro de conclusão; ainda faltam edição, reagendamento e filtros avançados.
- O planejamento semanal já permite criar e remover blocos e visualizar a carga horária por dia e total semanal; edição de blocos e comparação entre planejado e realizado ainda estão pendentes.
- O módulo de simulados permite criar, editar e excluir resultados, apresenta histórico e permite pesquisar por nome, banca, data ou observações; o histórico também exibe um gráfico cronológico com média e melhor desempenho dos últimos oito simulados. A validação automatizada de TypeScript, build e testes de interface é executada pelo GitHub Actions em cada atualização desta pasta.
- O caderno de erros permite criar, editar, excluir, pesquisar por enunciado, disciplina, assunto, respostas, explicação e etiquetas, além de filtrar por status. A jurisprudência permite criar, editar, excluir e pesquisar por tema, tribunal, processo e resumo. O formulário ainda não expõe edição de etiquetas.
- Sessões e tentativas de questões recebem a data atual automaticamente no fuso de Brasília; simulados e revisões usam datas informadas no formulário. Edição retroativa de sessões/tentativas e filtros por período ainda serão implementados.
- A migration e os testes de restauração foram executados com sucesso em PostgreSQL 15 temporário no CI, com objetos mínimos de compatibilidade Supabase; isso não equivale à aplicação ou validação no projeto Supabase hospedado. Nenhum fluxo de autenticação ou restauração foi validado em ambiente real. O importador V1 ainda precisa de testes com backups reais anonimizados antes de uso em dados importantes.

## Dados e segurança

A chave publishable é própria para uso no cliente, desde que as políticas RLS estejam corretamente habilitadas. Nunca publique uma chave secreta/service-role nem a senha do banco. Cada tabela de dados pessoais usa `user_id` e políticas que limitam o acesso ao usuário autenticado.

A V1 deve permanecer publicada e intacta até a V2 ser testada e aprovada.
