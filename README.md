# Controle de Entrada — Festival de Música 2026

Sistema web simples para controle de entrada no teatro, com leitura de QR Code, busca manual e registro de entradas parciais.

## Estrutura

- `index.html` — interface web publicada no GitHub Pages.
- `version.json` — versão usada para atualização automática e redução de problemas de cache.
- `apps-script/Code.gs` — API principal do Google Apps Script.
- `apps-script/Config.gs` — configuração da planilha, colunas e regras.
- `apps-script/Reset.gs` — função manual para zerar os registros operacionais de teste.

## Fluxo de operação

1. No primeiro acesso de cada navegador/aparelho, o operador informa seu nome.
2. O nome fica salvo localmente naquele navegador e pode ser alterado pelo botão **Trocar operador**.
3. O convite pode ser localizado por leitura do QR Code ou por busca manual por nome/telefone.
4. O sistema mostra os saldos disponíveis de adultos e menores.
5. A quantidade de entrada inicia pelo saldo total disponível, mas pode ser reduzida para permitir entrada parcial.
6. Após a confirmação, a planilha é atualizada e um registro é gravado em `Historico_Entradas`.
7. Convites finalizados continuam aparecendo na busca manual, identificados como **FINALIZADO**, com operador e data/hora da última entrada quando disponíveis.

## Regras principais

- O `ID_QR` é sempre tratado como texto, evitando perda de precisão em identificadores longos.
- O QR Code contém somente o identificador do convite; as quantidades autorizadas vêm da planilha.
- Entradas parciais são permitidas enquanto houver saldo.
- O backend utiliza `LockService` para impedir que acessos simultâneos ultrapassem o saldo disponível.
- Convite com saldo zerado fica com status `CONCLUIDO` e não permite nova entrada.
- Registros de acessibilidade/apoio e convites de autoridade/parceiro recebem destaque na interface.

## Colunas operacionais da planilha

- `QTD_ENTRADA_ADULTO`
- `QTD_ENTRADA_MENOR`
- `SALDO_ADULTO`
- `SALDO_MENOR`
- `STATUS_ENTRADA`
- `ULTIMA_ENTRADA`
- `ULTIMO_OPERADOR`

## Histórico

A aba `Historico_Entradas` registra uma linha por movimentação, incluindo QR, usuário, quantidades registradas, saldos posteriores, operador e identificador da operação.

Para apagar apenas testes do histórico, a orientação é remover manualmente as linhas de dados da aba `Historico_Entradas`, preservando o cabeçalho.

## Reset para testes

A função `resetarControleEntradas()` em `apps-script/Reset.gs` deve ser executada manualmente no Google Apps Script quando for necessário restaurar os convites para o estado inicial.

Ela:

- zera as quantidades já registradas;
- restaura os saldos conforme as quantidades autorizadas;
- redefine o status para `AGUARDANDO`;
- limpa última entrada e último operador;
- não apaga o histórico.

## Atualização automática

O frontend consulta `version.json` e detecta publicações novas. Quando a versão muda, o sistema força uma única recarga com parâmetro de versão para evitar que o navegador permaneça usando uma cópia antiga em cache.

## Publicação

O frontend é hospedado via GitHub Pages. Após a validação de uma versão, a branch `main` deve representar a versão oficial em produção.
