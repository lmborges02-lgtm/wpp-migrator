# Desenvolvimento

Use um ambiente local sem contas nem contatos reais. Alterações precisam preservar os critérios de autorização e a exclusão de administradores descritos em [SECURITY.md](SECURITY.md).

## Preparação reproduzível

Com Node.js 22 ou 24 e pnpm 11.25.0:

```sh
pnpm install --frozen-lockfile
pnpm run check
pnpm test
pnpm run build
```

O projeto também aceita Node.js 20.19+ com npm, conforme o README. O lockfile versionado é `pnpm-lock.yaml`; para reproduzir exatamente as dependências, prefira pnpm. Não versione um segundo lockfile de outro gerenciador.

## Alterações

- Mantenha a política de seleção no serviço e a integração de rede no adaptador.
- Não crie comandos de adição direta, opções para ignorar autorização ou formas de desativar a exclusão de administradores.
- Revalide os arquivos depois de operações assíncronas e antes de efeitos externos.
- Adicione testes quando alterar autorização, cargos, limites, confirmação ou idempotência.
- Não registre erros brutos do transporte, credenciais ou textos de mensagens.
- Não use grupos reais em CI. Os testes devem continuar totalmente locais.
- Atualize README, documentação e CHANGELOG quando mudar comportamento.

Antes de um commit, confira os caminhos incluídos com `git diff --cached --name-only` e o conteúdo com `git diff --cached`. Sessão, dados e dependências instaladas não fazem parte do código-fonte.

## Dependências

Baileys está fixado em uma versão candidata. Atualize conscientemente, leia os avisos de segurança e valide mudanças na metadata, JIDs/LIDs e códigos de retorno. O SQLite usa um módulo nativo; teste também a instalação em uma máquina limpa. Os testes simulados não comprovam compatibilidade de ponta a ponta com o protocolo do WhatsApp.

## Licenciamento

Não foi escolhida uma licença de redistribuição para este código. A disponibilização no GitHub não concede automaticamente permissão de uso ou redistribuição a terceiros. Bibliotecas incluídas por dependência mantêm suas próprias licenças.
