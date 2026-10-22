# Migração de contatos autorizados

CLI local em Node.js 20.19+ e TypeScript. Somente considera números presentes na origem, explicitamente autorizados, ausentes do destino e fora da blocklist. Ser membro da origem basta para consultar os participantes que o WhatsApp disponibilizar; executar exige administração do destino.

**Aviso:** bibliotecas não oficiais violam os Termos do WhatsApp e podem resultar em restrição ou bloqueio do número. Use número secundário/de teste. Intervalos e limites não garantem proteção contra bloqueios. Esta aplicação não contorna privacidade nem restrições da plataforma. A integração usa Baileys 7.0.0-rc14, uma versão candidata; mudanças no protocolo podem exigir atualização. Consulte o [projeto oficial](https://github.com/WhiskeySockets/Baileys) e os [avisos de segurança](https://github.com/WhiskeySockets/Baileys/security/advisories).

## Instalação

Instale Node.js 20+ (preferencialmente uma versão LTS suportada), npm e execute nesta pasta:

```powershell
npm install
Copy-Item .env.example .env
Copy-Item authorized.csv.example authorized.csv
Copy-Item blocklist.csv.example blocklist.csv
npm run check
npm test
npm run build
```

`better-sqlite3` é nativo. Se não houver binário compatível, a instalação pode exigir Python e ferramentas de compilação C++ (Visual Studio Build Tools no Windows). Não há necessidade de instalar Chromium. Com pnpm, autorize os scripts nativos de `better-sqlite3` e `esbuild` quando solicitado.

## Uso passo a passo

1. Autentique e escaneie o QR em WhatsApp → Aparelhos conectados:

```powershell
npm start -- login
```

Se o WhatsApp reiniciar a conexão após ler o QR, execute `login` novamente; não apague a sessão. O programa não faz reconexões automáticas nem repete ações externas.

2. Veja IDs e administração dos grupos:

```powershell
npm start -- list-groups
npm start -- export-members --source "123456789@g.us"
```

O segundo comando gera `members.csv` com número e nome quando disponível. O WhatsApp frequentemente não fornece nomes/pushnames na metadata; a coluna ficará vazia. Identidades LID sem número telefônico resolvido são ignoradas e contabilizadas no terminal. Nunca são tratadas como números de telefone.

3. Crie `authorized.csv` manualmente, com **uma coluna**, cabeçalho opcional `numero` e um número por linha:

```csv
numero
5521999999999
5511988888888
```

Crie também `blocklist.csv`, mesmo que vazio. Seu formato é igual; ele sempre prevalece. Ambos são obrigatórios para planejar/executar. Arquivo ausente ou linha inválida aborta a operação. São aceitos `+`, espaços, parênteses e hífens; a normalização mantém somente o número internacional de 8–15 dígitos, sem `+`. Não se infere país ou DDD, nem se comprova a existência do número pela sintaxe. Números repetidos são deduplicados. Não use colunas extras, aspas, notação científica ou fórmulas de planilha nesses arquivos.

4. Simule (também é o comando padrão quando omitido):

```powershell
npm start -- plan --source "123456789@g.us" --dest "987654321@g.us"
npm start -- --source "123456789@g.us" --dest "987654321@g.us"
```

`plan` consulta metadata do WhatsApp e abre o SQLite somente para leitura, se já existir. Não adiciona, não envia mensagens e não grava CSV, banco, logs ou atualizações da sessão. Sua conexão usa chaves apenas em memória; se precisar renovar a sessão, execute `login` separadamente. A tabela mostra números mascarados, exclui tentativas anteriores e indica quem cabe no saldo diário. O `run` recalcula essa seleção ao iniciar.

5. Execute em terminal interativo:

```powershell
npm start -- run --source "123456789@g.us" --dest "987654321@g.us" --confirm
```

Sem `--confirm`, recusa antes de conectar. Com a flag, ainda exige digitar `MIGRAR`. O plano é recalculado para essa execução, apresentado antes da confirmação e limitado aos contatos então exibidos. Antes de cada tentativa, reconsulta os grupos, verifica administração e relê os arquivos de consentimento. Uma última leitura ocorre imediatamente antes de despachar a adição. Alterações de consentimento só podem afetar chamadas ainda não despachadas.

6. Falhas geram `convite-manual.csv` com número, motivo e destino. Após revisar o arquivo, você pode compartilhar o convite manualmente ou usar:

```powershell
npm start -- send-invite --source "123456789@g.us" --dest "987654321@g.us" --confirm --message "Você autorizou entrar no grupo. Aqui está o convite: {link}"
```

O texto deve incluir `{link}`. Este comando exige confirmação interativa independente e só envia a quem teve tentativa de adição sem sucesso, continua autorizado, pertence à origem, não está bloqueado e ainda não está no destino. Não lê a lista manual como fonte de autorização. Revalida o consentimento depois de obter o link. Não envia automaticamente após uma falha de adição. O link não é salvo em logs ou CSV.

## Limites, estado e falhas

Administradores e superadministradores da origem são excluídos antes da extração de número/nome em `export-members` e `plan`, mesmo que constem em `authorized.csv`. Também ficam fora de adições, mensagens de convite e da lista manual regenerada. A função é reconsultada antes de cada tentativa e depois da consulta de existência do número; no convite, novamente após obter o link. Promoções já visíveis na metadata impedem a ação. Não há opção para desativar essa exclusão.

A API retorna a metadata completa do grupo, incluindo cargos e identificadores de administradores; não permite solicitar somente membros comuns. Esses dados inevitavelmente chegam em memória para permitir a filtragem e a verificação de sua administração do destino. A aplicação não os usa como contatos de migração. Mudanças de cargo posteriores à última resposta do servidor não podem ser impedidas atomicamente pela API. CSVs exportados antes desta alteração devem ser regenerados.

- Lotes de 1 a 3 tentativas (`BATCH_SIZE`), padrão 1; pausa aleatória de 30–90 segundos entre lotes. Os intervalos podem aumentar, nunca ficar abaixo de 30 segundos.
- `DAILY_LIMIT` padrão 30. Conta **tentativas reservadas**, inclusive convites, falhas e resultados incertos, em todos os destinos do banco. É mais conservador que contar somente adições concluídas. Dia calculado por `TIME_ZONE`, padrão `America/Sao_Paulo`.
- Cada par destino/número/ação tem chave única. Reserva atômica `BEGIN IMMEDIATE` impede duplicatas concorrentes e estouro do limite diário no mesmo banco. Não execute cópias com bancos diferentes: o controle é local ao arquivo.
- Reserva antes da chamada: uma interrupção pode deixar `pending`. Não há repetição automática, inclusive no dia seguinte. Verifique manualmente o grupo antes de qualquer intervenção no banco. Nunca apague o banco para tentar de novo.
- `added`: código 200. `privacy`: 403, sem insistência. `no_whatsapp`: consulta negativa ou 404. `network_or_unknown`: falha sem resultado seguro. Outros retornos são registrados como `server_<código>`. Não é possível distinguir com segurança todos os motivos de erro do protocolo. A aplicação nunca usa o payload do erro para logar.
- `convite-manual.csv` inclui falhas e reservas pendentes; para falha de rede o resultado pode ser incerto. Confira o destino antes de convidar. Contatos bloqueados ou sem consentimento atual são removidos da exportação quando ela é regenerada.
- A idempotência é por destino. O mesmo número pode participar de dois destinos diferentes se continuar autorizado e for confirmado separadamente.

## Arquitetura e privacidade

```text
src/cli.ts        argumentos e confirmação
src/config.ts     ambiente e limites
src/policy.ts     normalização, interseção, blocklist e calendário
src/files.ts      CSV estrito e exportação
src/whatsapp.ts   sessão, QR e adaptador Baileys
src/service.ts    plano e execução com revalidação
src/store.ts      reservas, resultados e limite SQLite
src/errors.ts     erros de aplicação seguros para exibição
test/             testes unitários e serviço com transporte simulado
```

Sem telemetria ou envio a serviços de terceiros adicionais. Consultas, adições e mensagens necessariamente transitam pelo WhatsApp/Meta. Números completos ficam nos CSVs e SQLite locais; logs Pino têm horário ISO, número parcialmente mascarado, ação e resultado, sem credenciais ou conteúdo de mensagens. Logs internos do Baileys ficam desativados. Proteja sessão, backups e permissões do sistema operacional; os arquivos locais não são criptografados pela aplicação. Defina sua política de retenção e registre consentimento fora desta ferramenta conforme sua necessidade.

O `.gitignore` cobre sessão/dados padrão, CSVs, bancos, logs e `.env`. Se personalizar caminhos fora desta pasta, configure também os respectivos backups e exclusões de versionamento.

**Atenção ao workspace atual:** esta pasta está dentro de OneDrive. Embora a aplicação só grave localmente, o OneDrive pode sincronizar esses dados. Antes de autenticar ou criar CSVs reais, mova o projeto/dados para uma pasta fora de sincronização, ou configure todos os caminhos sensíveis no `.env` para uma pasta local não sincronizada.

## Verificação

Documentação complementar: [arquitetura](docs/ARCHITECTURE.md), [diagnóstico e operação](docs/TROUBLESHOOTING.md), [segurança](SECURITY.md), [contribuição](CONTRIBUTING.md) e [histórico](CHANGELOG.md).

Para instalações reproduzíveis, use `pnpm install --frozen-lockfile` com pnpm 11.25.0 e o `pnpm-lock.yaml` versionado. Com npm, `npm install` resolve os intervalos do `package.json`; o projeto não mantém um segundo lockfile.

`npm test` cobre normalização, interseção, blocklist, calendário/limite diário, reserva idempotente, dry-run sem gravação, ausência de confirmação/admin, revogação durante execução e falhas sem repetição. São testes locais com transporte simulado; não fazem login, não enviam mensagens e não adicionam pessoas. Um teste real depende de uma sessão e grupos de teste fornecidos pelo operador.
