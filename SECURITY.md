# Segurança e dados pessoais

## Regras obrigatórias

- Uma pessoa precisa estar na origem, constar em `authorized.csv`, estar fora da `blocklist.csv` e não participar do destino.
- Administradores e superadministradores da origem não são exportados, adicionados ou convidados, mesmo com autorização. Cargos são reconsultados durante a execução.
- `run` e `send-invite` precisam de `--confirm` e confirmação interativa. Não use automação para responder à confirmação.
- O SQLite reserva a tentativa antes da chamada externa. Falhas e resultados incertos não são repetidos automaticamente.
- `plan` não deve gravar arquivos nem realizar adições ou envio de mensagens.

Essas condições devem continuar sendo verificadas ao modificar a aplicação. Consulte [a arquitetura](docs/ARCHITECTURE.md) e os testes de regressão.

## Limites da garantia

A metadata do WhatsApp inclui os identificadores dos administradores. Ela precisa ser recebida em memória para filtrar cargos; não existe consulta desta aplicação que peça somente membros comuns. Não há transação atômica entre a consulta de cargo/consentimento e a operação remota: alterações posteriores à última verificação podem acontecer no servidor. A aplicação bloqueia com base nos dados mais recentes obtidos.

Não há criptografia dos CSVs, banco ou logs pela aplicação. As chaves de sessão dão acesso à conta vinculada. Proteja o usuário do sistema operacional, disco e backups. Não compartilhe a pasta de sessão.

Não envie sessão, `.env`, números reais, CSVs, banco ou logs para issues, pull requests ou anexos. O `.gitignore` cobre os caminhos padrão, mas não protege arquivos que alguém force adicionar nem destinos personalizados fora do projeto.

## Relatar um problema

Para falha que possa expor dados ou permitir contato não autorizado, use a opção de relato privado de vulnerabilidade do GitHub, se estiver habilitada no repositório. Caso indisponível, contate o proprietário por um canal privado já conhecido. Não publique detalhes exploráveis nem dados reais em issues. Use números fictícios e transporte simulado na reprodução.

## Incidentes

1. Interrompa a execução. Não apague o banco para tentar novamente.
2. Se a sessão vazou, revogue o dispositivo em WhatsApp → Aparelhos conectados.
3. Preserve uma cópia local protegida do banco para conferir tentativas pendentes no destino.
4. Corrija o consentimento ou a blocklist; regenere as exportações quando necessário.
5. Atualize as dependências afetadas e execute todos os testes antes de retomar com grupos de teste.

Uso de Baileys não é oficial e pode causar restrição da conta. Os intervalos implementados não garantem ausência de bloqueios.
