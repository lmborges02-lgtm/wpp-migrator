# Diagnóstico

| Sintoma | Ação |
| --- | --- |
| `Falta --confirm` | Use `plan` para simular ou execute `run --confirm` em terminal interativo |
| Não sou administrador | Confira o destino com `list-groups`; a aplicação aborta sem administração |
| QR lido, conexão encerrada | Execute `login` novamente com a mesma pasta de sessão |
| Sessão expirada ou revogada | Confira Aparelhos conectados e refaça `login` conforme necessário |
| CSV inválido | Use uma coluna, números internacionais, cabeçalho opcional `numero`; não inclua nomes nem aspas |
| Arquivo não encontrado | Verifique o diretório de execução e os caminhos no `.env`; os dois CSVs de consentimento são obrigatórios |
| Administrador não aparece no export/plano | Comportamento obrigatório, mesmo se estiver autorizado |
| Participante sem telefone | Identidade LID sem número resolvido é ignorada; não converta o identificador em telefone |
| Nenhum contato elegível | Confira origem, consentimento, blocklist, destino, cargos e tentativas anteriores no banco |
| Limite diário atingido | Aguarde o próximo dia em `TIME_ZONE`; não exclua o banco nem use outro arquivo para contornar o limite |
| Falha de rede ou resultado incerto | Confira manualmente o grupo; não repita automaticamente a tentativa |
| `privacy` | A aplicação não insistirá. Revise a lista manual e, se apropriado, use `send-invite` com confirmação |
| Falha ao carregar `better-sqlite3` | Reinstale com versão de Node suportada; confirme execução dos scripts nativos e ferramentas de compilação quando necessárias |
| pnpm informa scripts bloqueados | Revise os pacotes listados em `pnpm-workspace.yaml` e autorize seus scripts conforme solicitado pelo gerenciador |

## Operação compilada

Após `npm run build`, também é possível usar:

```sh
node dist/src/cli.js list-groups
node dist/src/cli.js plan --source "123456789@g.us" --dest "987654321@g.us"
```

Os IDs acima são exemplos; obtenha seus IDs reais com `list-groups`. Os caminhos relativos do `.env` são resolvidos a partir da pasta em que o comando foi executado.

## Backup e restauração

Pare a aplicação antes de copiar o SQLite e a sessão. Guarde o backup em local protegido, fora de sincronização automática se a política for manter tudo apenas no computador. Restaure sessão e banco de forma coerente: restaurar um banco antigo pode perder reservas recentes e permitir repetição. Confira o destino antes de retomar.

## Antes de compartilhar diagnóstico

Informe somente comando sem IDs reais, versão de Node, sistema operacional e código resumido da falha. Não anexe `.env`, sessão, CSV, banco, logs completos ou mensagens privadas. Uma falha de dependência deve ser reproduzida com dados fictícios.
