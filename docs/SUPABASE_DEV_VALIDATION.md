# Checklist de validação em ambiente Supabase de desenvolvimento

Este roteiro é apenas preparatório. **Não aplique a migration nem execute testes no projeto hospedado sem autorização explícita da Brenda.** A validação automatizada atual usa PostgreSQL 15 temporário com objetos mínimos de compatibilidade Supabase; ela não substitui os testes abaixo.

## 1. Isolamento e preparação

- [ ] Confirmar que o projeto escolhido é exclusivamente de desenvolvimento e não contém dados de produção.
- [ ] Se necessário, criar um projeto Supabase separado para testes.
- [ ] Registrar o Project URL e a publishable key em ambiente local, sem publicar chaves secretas.
- [ ] Configurar Authentication > URL Configuration para o endereço local de desenvolvimento.
- [ ] Configurar confirmação de e-mail e recuperação de senha.
- [ ] Configurar Google OAuth separadamente, incluindo credenciais e URLs de redirecionamento.

## 2. Revisão e aplicação da migration

- [ ] Revisar integralmente `supabase/migrations/0001_initial_schema.sql`.
- [ ] Confirmar a versão PostgreSQL compatível (15 ou superior).
- [ ] Aplicar a migration somente no projeto de desenvolvimento isolado.
- [ ] Conferir criação das tabelas, índices, triggers, funções e políticas RLS.
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

## 5. Backup e restauração

- [ ] Criar registros de teste e exportar um backup JSON.
- [ ] Guardar uma cópia do arquivo fora do projeto de teste.
- [ ] Restaurar o backup em uma conta de teste isolada e conferir contagens e vínculos.
- [ ] Repetir a restauração e confirmar que IDs existentes são ignorados sem duplicação.
- [ ] Testar arquivo inválido ou com seções obrigatórias ausentes; a restauração deve falhar sem inserir registros parciais.
- [ ] Testar conflito com a regra de um único plano ativo; toda a transação deve sofrer rollback.
- [ ] Confirmar que um backup contendo `user_id` diferente não grava registros em nome de outro usuário.

## 6. Critérios para considerar a validação concluída

- [ ] Autenticação por e-mail testada com sucesso.
- [ ] Google OAuth testado, se for requisito para o lançamento.
- [ ] RLS verificada com pelo menos duas contas.
- [ ] Exportação e restauração verificadas com dados descartáveis.
- [ ] Falhas e conflitos confirmados como transacionais na restauração.
- [ ] Resultados registrados antes de qualquer decisão sobre migração de dados reais.

## 7. Limpeza

- [ ] Excluir contas e registros de teste, ou descartar o projeto Supabase de desenvolvimento.
- [ ] Preservar os backups de teste apenas enquanto forem necessários e removê-los com segurança depois.
- [ ] Não importar dados pessoais ou backups reais durante os testes iniciais.

**Regra de rollout:** a V1 publicada permanece intacta. A migration no Supabase hospedado, a migração de dados reais, o merge e o deploy da V2 exigem aprovação explícita e etapas separadas.
