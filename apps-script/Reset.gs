/**
 * Reseta o controle operacional de entradas sem apagar o histórico.
 *
 * Resultado esperado por convite:
 * - QTD_ENTRADA_ADULTO = 0
 * - QTD_ENTRADA_MENOR = 0
 * - SALDO_ADULTO = quantidade originalmente autorizada
 * - SALDO_MENOR = quantidade originalmente autorizada
 * - STATUS_ENTRADA = AGUARDANDO
 * - ULTIMA_ENTRADA = vazio
 * - ULTIMO_OPERADOR = vazio
 *
 * A aba Historico_Entradas não é alterada.
 */
function resetarControleEntradas() {
  const lock = LockService.getScriptLock();
  lock.waitLock(CONFIG.LOCK_TIMEOUT_MS);

  try {
    const contexto = getContexto_();
    const sheet = contexto.sheet;
    const lastRow = sheet.getLastRow();

    if (lastRow < 2) {
      return {
        sucesso: true,
        linhasProcessadas: 0,
        mensagem: 'Nenhum convite para resetar.'
      };
    }

    const quantidadeLinhas = lastRow - 1;

    const colAdultosTotal = coluna_(contexto, CONFIG.COLUMNS.ADULTS_AUTHORIZED);
    const colMenoresTotal = coluna_(contexto, CONFIG.COLUMNS.MINORS_AUTHORIZED);
    const colAdultosEntraram = coluna_(contexto, CONFIG.COLUMNS.ADULTS_ENTERED);
    const colMenoresEntraram = coluna_(contexto, CONFIG.COLUMNS.MINORS_ENTERED);
    const colSaldoAdultos = coluna_(contexto, CONFIG.COLUMNS.ADULTS_BALANCE);
    const colSaldoMenores = coluna_(contexto, CONFIG.COLUMNS.MINORS_BALANCE);
    const colStatus = coluna_(contexto, CONFIG.COLUMNS.ENTRY_STATUS);
    const colUltimaEntrada = coluna_(contexto, CONFIG.COLUMNS.LAST_ENTRY);
    const colUltimoOperador = coluna_(contexto, CONFIG.COLUMNS.LAST_OPERATOR);

    validarBlocoOperacionalContiguo_([
      colAdultosEntraram,
      colMenoresEntraram,
      colSaldoAdultos,
      colSaldoMenores,
      colStatus,
      colUltimaEntrada,
      colUltimoOperador
    ]);

    const valores = sheet
      .getRange(2, 1, quantidadeLinhas, contexto.headers.length)
      .getDisplayValues();

    const saida = valores.map(function(linha) {
      const adultosTotal = inteiroNaoNegativo_(linha[colAdultosTotal - 1]);
      const menoresTotal = inteiroNaoNegativo_(linha[colMenoresTotal - 1]);

      return [
        0,
        0,
        adultosTotal,
        menoresTotal,
        CONFIG.ENTRY_STATUS.WAITING,
        '',
        ''
      ];
    });

    sheet
      .getRange(2, colAdultosEntraram, quantidadeLinhas, 7)
      .setValues(saida);

    return {
      sucesso: true,
      linhasProcessadas: quantidadeLinhas,
      mensagem: 'Controle de entradas resetado com sucesso.'
    };
  } finally {
    if (lock.hasLock()) {
      lock.releaseLock();
    }
  }
}
