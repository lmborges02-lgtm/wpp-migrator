# Histórico

## 1.0.0 — 2026-10-22

- CLI TypeScript com login por QR, sessão local, listagem de grupos e exportação CSV.
- Plano somente leitura e execução com flag e confirmação interativa.
- Interseção entre origem e autorizados, exclusão do destino e prioridade da blocklist.
- Exclusão obrigatória de administradores e superadministradores da origem em exportações, planos e convites.
- Revalidação de consentimento, cargos e administração durante a execução.
- Reservas SQLite idempotentes, limite diário e pausas aleatórias entre lotes.
- Tratamento por contato, lista de convites manuais e envio separado com confirmação.
- Logs locais com números mascarados, sem conteúdo de mensagens ou credenciais.
- Testes locais de política, CSV, persistência e serviço, incluindo promoções a administrador durante a operação.

Validação local: compilação TypeScript e 16 testes passaram em Node.js 24.19.0, sem conectar uma conta real ao WhatsApp. A integração real ainda depende de teste do operador com uma conta e grupos de teste.
