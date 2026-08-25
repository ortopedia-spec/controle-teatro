/**
 * Painel de acompanhamento da entrada do público.
 * Consulta agregada, sem alterar a lógica de validação dos convites.
 */

const THEATER_CAPACITY = 458;

function obterStatusEntrada_() {
  const contexto = getContexto_();
  const sheet = contexto.sheet;
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return montarStatusEntrada_(0, 0, 0, 0);
  }

  const quantidadeLinhas = lastRow - 1;
  const colAdultosAutorizados = coluna_(contexto, CONFIG.COLUMNS.ADULTS_AUTHORIZED);
  const colMenoresAutorizados = coluna_(contexto, CONFIG.COLUMNS.MINORS_AUTHORIZED);
  const colAdultosEntraram = coluna_(contexto, CONFIG.COLUMNS.ADULTS_ENTERED);
  const colMenoresEntraram = coluna_(contexto, CONFIG.COLUMNS.MINORS_ENTERED);

  const autorizados = sheet
    .getRange(2, colAdultosAutorizados, quantidadeLinhas, 2)
    .getDisplayValues();

  const entradas = sheet
    .getRange(2, colAdultosEntraram, quantidadeLinhas, 2)
    .getDisplayValues();

  let adultosReservados = 0;
  let menoresReservados = 0;
  let adultosEntraram = 0;
  let menoresEntraram = 0;

  for (let i = 0; i < quantidadeLinhas; i += 1) {
    adultosReservados += inteiroNaoNegativo_(autorizados[i][0]);
    menoresReservados += inteiroNaoNegativo_(autorizados[i][1]);
    adultosEntraram += inteiroNaoNegativo_(entradas[i][0]);
    menoresEntraram += inteiroNaoNegativo_(entradas[i][1]);
  }

  return montarStatusEntrada_(
    adultosReservados,
    menoresReservados,
    adultosEntraram,
    menoresEntraram
  );
}

function montarStatusEntrada_(adultosReservados, menoresReservados, adultosEntraram, menoresEntraram) {
  const totalReservado = adultosReservados + menoresReservados;
  const totalEntradas = adultosEntraram + menoresEntraram;
  const aguardados = Math.max(0, totalReservado - totalEntradas);
  const lugaresDisponiveis = Math.max(0, THEATER_CAPACITY - totalEntradas);
  const overbooking = Math.max(0, totalReservado - THEATER_CAPACITY);
  const comparecimento = totalReservado > 0 ? (totalEntradas / totalReservado) * 100 : 0;
  const ocupacao = THEATER_CAPACITY > 0 ? (totalEntradas / THEATER_CAPACITY) * 100 : 0;

  return {
    capacidade: THEATER_CAPACITY,
    reservas: {
      adultos: adultosReservados,
      menores: menoresReservados,
      total: totalReservado
    },
    entradas: {
      adultos: adultosEntraram,
      menores: menoresEntraram,
      total: totalEntradas
    },
    comparecimentoPercentual: comparecimento,
    ocupacaoPercentual: ocupacao,
    aguardados: aguardados,
    lugaresDisponiveis: lugaresDisponiveis,
    overbooking: overbooking,
    atualizadoEm: new Date().toISOString()
  };
}
