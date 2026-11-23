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
- Aplique a migration `supabase/migrations/0001_initial_schema.sql` somente após revisão e em um projeto de desenvolvimento.

A criação do projeto Supabase não configura automaticamente o provedor Google. O botão Google só funcionará depois dessa configuração.

## Estado atual

- [x] Estrutura inicial React/TypeScript/Vite em `v2/`
- [x] Cliente Supabase tipado por variáveis de ambiente
- [x] Tela inicial de login Google e e-mail/senha
- [x] Cadastro por e-mail e recuperação de senha
- [x] Tela de definição de nova senha para o fluxo de recuperação
- [x] Esqueleto do app autenticado
- [x] Primeira migration SQL e documentação de arquitetura
- [ ] Instalar dependências e executar build em ambiente com acesso ao npm
- [ ] Validar migration no banco de desenvolvimento
- [ ] Configurar e testar Google OAuth e e-mail
- [x] Criar serviços Supabase para disciplinas, assuntos, sessões e tentativas de questões
- [x] Implementar dashboard com métricas, cadastro de disciplinas/assuntos e alteração de status
- [x] Implementar registro manual de tempo de estudo e desempenho em questões
- [x] Implementar planejamento semanal por dia, disciplina, assunto, horário e duração
- [x] Exibir carga horária semanal e permitir remover blocos de estudo
- [ ] Implementar importação e validação dos dados exportados da V1
- [x] Criar serviços de agendamento, listagem e conclusão de revisões
- [x] Adicionar painel de revisões programadas, atrasadas e concluídas
- [ ] Testes automatizados de segurança, migração e analytics

## Limitações conhecidas nesta etapa

- O dashboard registra sessões e tentativas manualmente; ainda não há importador real do Tec Concursos.
- O módulo de revisões já permite agendamento, identificação de atrasos e registro de conclusão; ainda faltam edição, reagendamento e filtros avançados.
- O planejamento semanal já permite criar e remover blocos e visualizar a carga horária por dia e total semanal; edição de blocos e comparação entre planejado e realizado ainda estão pendentes.
- Simulados e caderno de erros ainda não têm interface funcional nesta etapa.
- Os formulários atuais registram data e hora automaticamente no fuso de Brasília; edição retroativa e filtros por período ainda serão implementados.
- Nenhuma migration foi executada no banco e nenhum fluxo de autenticação foi validado em ambiente real.

## Dados e segurança

A chave publishable é própria para uso no cliente, desde que as políticas RLS estejam corretamente habilitadas. Nunca publique uma chave secreta/service-role nem a senha do banco. Cada tabela de dados pessoais usa `user_id` e políticas que limitam o acesso ao usuário autenticado.

A V1 deve permanecer publicada e intacta até a V2 ser testada e aprovada.
