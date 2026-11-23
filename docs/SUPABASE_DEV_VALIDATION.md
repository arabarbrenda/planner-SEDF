# Checklist de validação em ambiente Supabase de desenvolvimento

Este roteiro é apenas preparatório. **Não aplique migrations nem execute testes no projeto hospedado sem autorização explícita da Brenda.** A validação automatizada atual usa PostgreSQL 15 temporário com objetos mínimos de compatibilidade Supabase; ela não substitui os testes abaixo.

## 1. Isolamento e preparação

- [ ] Confirmar que o projeto escolhido é exclusivamente de desenvolvimento e não contém dados de produção.
- [ ] Se necessário, criar um projeto Supabase separado para testes.
- [ ] Registrar o Project URL e a publishable key em ambiente local, sem publicar chaves secretas.
- [ ] Configurar Authentication > URL Configuration para o endereço local de desenvolvimento.
- [ ] Configurar confirmação de e-mail e recuperação de senha.
- [ ] Configurar Google OAuth separadamente, incluindo credenciais e URLs de redirecionamento.

## 2. Revisão e aplicação das migrations

- [ ] Revisar integralmente `supabase/migrations/0001_initial_schema.sql` e `supabase/migrations/0002_atomic_legacy_import.sql`.
- [ ] Confirmar a versão PostgreSQL compatível (15 ou superior).
- [ ] Aplicar as migrations **na ordem numérica**, somente no projeto de desenvolvimento isolado.
- [ ] Conferir criação das tabelas, índices, triggers, funções e políticas RLS.
- [ ] Conferir permissões das RPCs: funções de restauração e importação executáveis apenas por `authenticated`, não por `anon` ou `public`.
- [ ] Confirmar que nenhuma tabela de dados do usuário permite leitura ou escrita anônima.

## 3. Autenticação

- [ ] Criar duas contas de teste independentes.
- [ ] Testar cadastro, confirmação de e-mail, login e logout.
- [ ] Testar solicitação e conclusão de recuperação de senha.
- [ ] Testar login Google somente depois de configurar o provedor.
- [ ] Verificar persistência e renovação da sessão após recarregar a página.

## 4. Isolamento por usuário (RLS)

- [ ] Na conta A, criar disciplinas, assuntos, sessões, questões, revisões e um plano.
- [ ] Na conta B, confirmar que os registros da conta A não aparecem.
- [ ] Tentar acessar ou associar IDs da conta A a registros da conta B; a operação deve ser negada.
- [ ] Confirmar que a função de resumo retorna somente métricas do usuário autenticado.
- [ ] Confirmar que a conta B não consegue ler nem alterar o histórico de importação da conta A.

## 5. Backup e restauração V2

- [ ] Criar registros de teste e exportar um backup JSON.
- [ ] Guardar uma cópia do arquivo fora do projeto de teste.
- [ ] Restaurar o backup em uma conta de teste isolada e conferir contagens e vínculos.
- [ ] Repetir a restauração e confirmar que IDs existentes são ignorados sem duplicação.
- [ ] Testar arquivo inválido ou com seções obrigatórias ausentes; a restauração deve falhar sem inserir registros parciais.
- [ ] Testar conflito com a regra de um único plano ativo; toda a transação deve sofrer rollback.
- [ ] Confirmar que um backup contendo `user_id` diferente não grava registros em nome de outro usuário.

## 6. Importação legada V1

- [ ] Usar somente um backup V1 fictício ou anonimizado, nunca o backup pessoal real nos primeiros testes.
- [ ] Conferir a prévia e as contagens antes de confirmar a importação.
- [ ] Confirmar o mapeamento de disciplinas e assuntos e os vínculos das sessões, simulados e jurisprudência.
- [ ] Confirmar que os totais de questões por assunto são importados uma única vez e que os totais das sessões não são somados novamente.
- [ ] Forçar uma falha durante a importação e confirmar rollback dos dados importados.
- [ ] Repetir a importação após falha com o mesmo fingerprint e confirmar que a tentativa pode ser refeita.
- [ ] Repetir uma importação já concluída com o mesmo fingerprint e confirmar que ela é bloqueada.
- [ ] Confirmar que usuários diferentes podem importar independentemente e não conseguem consultar ou alterar o histórico um do outro.
- [ ] Registrar as limitações conhecidas: planejamento/ciclo e configurações não são importados; simulados V1 não possuem campo de questões em branco; importação real do Tec Concursos depende de uma amostra de exportação anonimizada.

## 7. Critérios para considerar a validação concluída

- [ ] Autenticação por e-mail testada com sucesso.
- [ ] Google OAuth testado, se for requisito para o lançamento.
- [ ] RLS verificada com pelo menos duas contas.
- [ ] Exportação e restauração verificadas com dados descartáveis.
- [ ] Importação V1 testada quanto a mapeamento, rollback, repetição segura e isolamento entre usuários.
- [ ] Permissões de execução das RPCs conferidas para usuários autenticados e anônimos.
- [ ] Resultados registrados antes de qualquer decisão sobre migração de dados reais.

## 8. Limpeza

- [ ] Excluir contas e registros de teste, ou descartar o projeto Supabase de desenvolvimento.
- [ ] Preservar os backups de teste apenas enquanto forem necessários e removê-los com segurança depois.
- [ ] Não importar dados pessoais ou backups reais durante os testes iniciais.

**Regra de rollout:** a V1 publicada permanece intacta. A aplicação de migrations no Supabase hospedado, a migração de dados reais, o merge e o deploy da V2 exigem aprovação explícita e etapas separadas.
