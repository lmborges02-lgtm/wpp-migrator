# Arquitetura e invariantes

## Componentes

| Arquivo | Responsabilidade |
| --- | --- |
| `src/cli.ts` | Validar comandos e IDs, exigir terminal interativo, apresentar resultados e encerrar recursos |
| `src/config.ts` | Ler ambiente, caminhos, fuso e limites |
| `src/files.ts` | Interpretar arquivos de consentimento estritos e exportar CSV |
| `src/policy.ts` | Normalizar telefones, aplicar interseção e blocklist, calcular dia e mascarar números |
| `src/whatsapp.ts` | Encapsular Baileys, sessão, metadata e operações remotas; filtrar membros comuns |
| `src/service.ts` | Construir plano, revalidar elegibilidade e coordenar execução |
| `src/store.ts` | Reservar tentativas e guardar estado idempotente no SQLite |
| `src/errors.ts` | Identificar mensagens de erro da aplicação que podem aparecer no terminal |

## Seleção

```text
metadata da origem
  → remover admin/superadmin antes de extrair telefone/nome
  → descartar identidades sem número telefônico resolvido
  → intersectar com authorized.csv
  → remover blocklist.csv e participantes do destino
  → remover tentativas anteriores da ação
  → respeitar saldo diário
```

A consulta do destino inclui todos os seus participantes para evitar duplicação. A verificação de administração do operador usa identificadores da própria sessão, inclusive LID quando disponível. `authorized.csv` é a fonte de consentimento; exportações e histórico do SQLite não substituem a autorização vigente.

## Execução

1. Exigir `--confirm`, terminal interativo e administração do destino.
2. Obter e apresentar a seleção, sem criar novos candidatos depois da confirmação.
3. Exigir o texto `MIGRAR`.
4. Aplicar pausa entre lotes, consultar novamente os grupos e reler os arquivos.
5. Reservar a tentativa em transação SQLite imediata, respeitando chave única e limite diário.
6. Consultar existência do número no WhatsApp e revalidar elegibilidade.
7. Adicionar, ou obter o link e revalidar novamente antes de enviar o convite.
8. Persistir resultado e registrar somente número mascarado, ação e resultado.
9. Regenerar a lista manual filtrando membros comuns e consentimento vigente.

Os retornos de erro do transporte não são gravados em bruto. Uma exceção remota não gera nova tentativa automática.

## Estado

Tabela `attempts`:

| Coluna | Significado |
| --- | --- |
| `dest` | ID do grupo destino |
| `phone` | Telefone normalizado |
| `action` | `add` ou `invite` |
| `day` | Dia da reserva no fuso configurado |
| `status` | `pending`, sucesso ou motivo resumido de falha |
| `at` | Horário ISO da reserva |

Chave primária: `(dest, phone, action)`. A contagem diária reúne todos os destinos e ambas as ações do mesmo banco, inclusive falhas. Uma reserva `pending` pode representar queda antes ou depois de uma operação remota. Não é seguro apagá-la e repetir sem conferir o grupo.

## Dry-run

O comando `plan` conecta apenas para consultar metadata, desativa a persistência de chaves/credenciais e abre o banco existente somente para leitura. Banco ausente não é criado. Não inicializa logs nem escreve exportações. A conexão em modo somente leitura pode falhar quando o protocolo exigir renovação de sessão; nesse caso, o operador deve executar `login` e tentar novamente.

## Limitações

- Estado e limites são compartilhados apenas entre processos que usam o mesmo arquivo SQLite.
- A API não oferece uma transação que combine consulta de cargo, leitura de consentimento e adição. Não há garantia para alterações posteriores à última verificação.
- `admin`/`superadmin` e outros cargos não vazios são excluídos; `null`/ausente identifica membro comum conforme o modelo da biblioteca.
- O servidor retorna metadata completa; identificadores administrativos transitam em memória para filtragem, mas não são selecionados como contatos da origem.
- Os testes usam transporte simulado; protocolo e disponibilidade do WhatsApp exigem verificação separada com grupos de teste.
