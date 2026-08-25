/**
 * ============================================================================
 * API — CONTROLE DE ENTRADA DO TEATRO
 * ============================================================================
 * Festival de Música 2026
 *
 * Principais ações:
 * - buscarConvite: localiza um convite pelo ID_QR.
 * - buscarConvites: busca manual por nome ou telefone.
 * - registrarEntrada: registra entradas parciais de adultos e menores.
 * - statusEntrada: retorna totais agregados de reservas, entradas e ocupação.
 * - inicializarControleEntradas: preenche saldos/status iniciais na planilha.
 *
 * O ID_QR é sempre tratado como texto para evitar perda de precisão.
 * ============================================================================
 */

function doGet(e) {
  try {
    const action = normalizarAcao_(e && e.parameter ? e.parameter.action : '');

    if (!action || action === 'health') {
      return respostaJson_({
        ok: true,
        data: {
          status: 'online',
          projeto: 'controle-entrada-teatro',
          versao: '1.1',
          dataHora: new Date().toISOString()
        }
      });
    }

    return respostaJson_({
      ok: false,
      error: {
        code: 'ACAO_INVALIDA',
        message: 'Ação GET não reconhecida.'
      }
    });
  } catch (erro) {
    return respostaErro_(erro);
  }
}

function doPost(e) {
  try {
    const payload = lerPayload_(e);
    const action = normalizarAcao_(payload.action);

    if (action === 'health') {
      return respostaJson_({
        ok: true,
        data: {
          status: 'online',
          versao: '1.1',
          dataHora: new Date().toISOString()
        }
      });
    }

    if (action === 'buscarconvite' || action === 'buscar') {
      const idQr = payload.id_qr || payload.idQr || payload.id || payload.qr || '';
      return respostaJson_({ ok: true, data: buscarConvitePorId_(idQr) });
    }

    if (
      action === 'buscarconvites' ||
      action === 'buscarmanual' ||
      action === 'listarpedentes'
    ) {
      const termo = payload.termo || payload.query || payload.filtro || '';
      const somenteAbertos = payload.somenteAbertos !== false && payload.incluirConcluidos !== true;
      return respostaJson_({
        ok: true,
        data: buscarConvites_(termo, somenteAbertos)
      });
    }

    if (action === 'statusentrada' || action === 'ocupacao') {
      return respostaJson_({
        ok: true,
        data: obterStatusEntrada_()
      });
    }

    if (action === 'registrarentrada' || action === 'confirmar') {
      return respostaJson_({
        ok: true,
        data: registrarEntrada_(payload)
      });
    }

    return respostaJson_({
      ok: false,
      error: {
        code: 'ACAO_INVALIDA',
        message: 'Ação POST não reconhecida.'
      }
    });
  } catch (erro) {
    return respostaErro_(erro);
  }
}

function inicializarControleEntradas() {
  const lock = LockService.getScriptLock();
  lock.waitLock(CONFIG.LOCK_TIMEOUT_MS);

  try {
    const contexto = getContexto_();
    const sheet = contexto.sheet;
    const lastRow = sheet.getLastRow();

    garantirHistorico_(contexto.spreadsheet);

    if (lastRow < 2) {
      return {
        sucesso: true,
        linhasProcessadas: 0,
        mensagem: 'Nenhum convite para inicializar.'
      };
    }

    const quantidadeLinhas = lastRow - 1;
    const raw = sheet.getRange(2, 1, quantidadeLinhas, contexto.headers.length).getValues();
    const display = sheet.getRange(2, 1, quantidadeLinhas, contexto.headers.length).getDisplayValues();

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

    const saida = raw.map(function(linha, i) {
      const convite = montarConvite_(contexto, linha, display[i], i + 2);

      return [
        convite.adultosEntraram,
        convite.menoresEntraram,
        convite.saldoAdultos,
        convite.saldoMenores,
        convite.statusEntrada,
        linha[colUltimaEntrada - 1] || '',
        linha[colUltimoOperador - 1] || ''
      ];
    });

    sheet
      .getRange(2, colAdultosEntraram, quantidadeLinhas, 7)
      .setValues(saida);

    return {
      sucesso: true,
      linhasProcessadas: quantidadeLinhas,
      mensagem: 'Controle de entradas inicializado com sucesso.'
    };
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function buscarConvitePorId_(idQr) {
  const id = normalizarIdQr_(idQr);

  if (!id) {
    throw criarErro_('ID_QR_VAZIO', 'ID_QR não informado.');
  }

  const contexto = getContexto_();
  const numeroLinha = localizarLinhaPorIdQr_(contexto, id);

  if (!numeroLinha) {
    throw criarErro_('CONVITE_NAO_ENCONTRADO', 'Convite não encontrado.');
  }

  return lerConviteDaLinha_(contexto, numeroLinha);
}

function buscarConvites_(termo, somenteAbertos) {
  const contexto = getContexto_();
  const sheet = contexto.sheet;
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return [];

  const quantidadeLinhas = lastRow - 1;
  const raw = sheet.getRange(2, 1, quantidadeLinhas, contexto.headers.length).getValues();
  const display = sheet.getRange(2, 1, quantidadeLinhas, contexto.headers.length).getDisplayValues();

  const termoTexto = normalizarComparacao_(termo);
  const termoDigitos = somenteDigitos_(termo);

  const resultados = [];

  for (let i = 0; i < raw.length; i += 1) {
    const convite = montarConvite_(contexto, raw[i], display[i], i + 2);

    if (!convite.idQr) continue;
    if (somenteAbertos && convite.statusEntrada === CONFIG.ENTRY_STATUS.COMPLETED) continue;

    if (termoTexto || termoDigitos) {
      const nomeComparacao = normalizarComparacao_(convite.nome);
      const telefoneDigitos = somenteDigitos_(convite.telefone);

      const encontrouNome = termoTexto && nomeComparacao.indexOf(termoTexto) !== -1;
      const encontrouTelefone = termoDigitos && telefoneDigitos.indexOf(termoDigitos) !== -1;

      if (!encontrouNome && !encontrouTelefone) continue;
    }

    resultados.push(convite);

    if (resultados.length >= CONFIG.SEARCH.MAX_RESULTS) break;
  }

  resultados.sort(function(a, b) {
    return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', {
      sensitivity: 'base'
    });
  });

  return resultados;
}

function registrarEntrada_(payload) {
  const idQr = normalizarIdQr_(payload.id_qr || payload.idQr || payload.id || payload.qr || '');
  const adultosEntrada = inteiroNaoNegativo_(payload.adultos_entrada !== undefined ? payload.adultos_entrada : payload.adultosEntrada);
  const menoresEntrada = inteiroNaoNegativo_(payload.menores_entrada !== undefined ? payload.menores_entrada : payload.menoresEntrada);
  const operador = texto_(payload.operador || CONFIG.DEFAULT_OPERATOR) || CONFIG.DEFAULT_OPERATOR;

  if (!idQr) {
    throw criarErro_('ID_QR_VAZIO', 'ID_QR não informado.');
  }

  if (adultosEntrada <= 0 && menoresEntrada <= 0) {
    throw criarErro_('QUANTIDADE_VAZIA', 'Informe ao menos uma entrada de adulto ou menor.');
  }

  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(CONFIG.LOCK_TIMEOUT_MS);
  } catch (erroLock) {
    throw criarErro_('ERRO_LOCK', 'Outra entrada está sendo registrada. Tente novamente em instantes.');
  }

  try {
    const contexto = getContexto_();
    const numeroLinha = localizarLinhaPorIdQr_(contexto, idQr);

    if (!numeroLinha) {
      throw criarErro_('CONVITE_NAO_ENCONTRADO', 'Convite não encontrado.');
    }

    const conviteAntes = lerConviteDaLinha_(contexto, numeroLinha);

    if (adultosEntrada > conviteAntes.saldoAdultos) {
      throw criarErro_(
        'SALDO_ADULTO_INSUFICIENTE',
        'Quantidade de adultos maior que o saldo disponível (' + conviteAntes.saldoAdultos + ').'
      );
    }

    if (menoresEntrada > conviteAntes.saldoMenores) {
      throw criarErro_(
        'SALDO_MENOR_INSUFICIENTE',
        'Quantidade de menores maior que o saldo disponível (' + conviteAntes.saldoMenores + ').'
      );
    }

    const adultosDepois = conviteAntes.adultosEntraram + adultosEntrada;
    const menoresDepois = conviteAntes.menoresEntraram + menoresEntrada;
    const saldoAdultosDepois = Math.max(0, conviteAntes.adultosTotal - adultosDepois);
    const saldoMenoresDepois = Math.max(0, conviteAntes.menoresTotal - menoresDepois);
    const statusDepois = calcularStatusEntrada_(
      conviteAntes.adultosTotal,
      conviteAntes.menoresTotal,
      adultosDepois,
      menoresDepois
    );

    const dataHora = new Date();
    const idOperacao = Utilities.getUuid();

    gravarControleLinha_(
      contexto,
      numeroLinha,
      adultosDepois,
      menoresDepois,
      saldoAdultosDepois,
      saldoMenoresDepois,
      statusDepois,
      dataHora,
      operador
    );

    registrarHistoricoEntrada_(contexto.spreadsheet, {
      DATA_HORA: dataHora,
      ID_QR: conviteAntes.idQr,
      NOME: conviteAntes.nome,
      TELEFONE: conviteAntes.telefone,
      TIPO_CONVITE: conviteAntes.tipoConvite,
      ADULTOS_ENTRADA: adultosEntrada,
      MENORES_ENTRADA: menoresEntrada,
      ADULTOS_ENTRADA_ANTES: conviteAntes.adultosEntraram,
      MENORES_ENTRADA_ANTES: conviteAntes.menoresEntraram,
      SALDO_ADULTO_APOS: saldoAdultosDepois,
      SALDO_MENOR_APOS: saldoMenoresDepois,
      STATUS_ENTRADA_APOS: statusDepois,
      OPERADOR: operador,
      ID_OPERACAO: idOperacao
    });

    const conviteDepois = lerConviteDaLinha_(contexto, numeroLinha);

    return {
      sucesso: true,
      idOperacao: idOperacao,
      adultosEntrada: adultosEntrada,
      menoresEntrada: menoresEntrada,
      convite: conviteDepois
    };
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function getContexto_() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetById(CONFIG.INVITATIONS_SHEET_ID);

  if (!sheet) {
    throw criarErro_('ABA_CONVITES_NAO_ENCONTRADA', 'A aba principal de convites não foi encontrada.');
  }

  const lastColumn = sheet.getLastColumn();

  if (lastColumn < 1) {
    throw criarErro_('PLANILHA_SEM_CABECALHO', 'A planilha não possui cabeçalhos.');
  }

  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  const columnMap = {};

  headers.forEach(function(header, index) {
    const chave = normalizarCabecalho_(header);
    if (chave) columnMap[chave] = index + 1;
  });

  const contexto = {
    spreadsheet: spreadsheet,
    sheet: sheet,
    headers: headers,
    columnMap: columnMap
  };

  Object.keys(CONFIG.COLUMNS).forEach(function(key) {
    coluna_(contexto, CONFIG.COLUMNS[key]);
  });

  return contexto;
}

function lerConviteDaLinha_(contexto, numeroLinha) {
  const raw = contexto.sheet.getRange(numeroLinha, 1, 1, contexto.headers.length).getValues()[0];
  const display = contexto.sheet.getRange(numeroLinha, 1, 1, contexto.headers.length).getDisplayValues()[0];
  return montarConvite_(contexto, raw, display, numeroLinha);
}

function montarConvite_(contexto, raw, display, numeroLinha) {
  const adultosTotal = inteiroNaoNegativo_(valorDisplay_(contexto, display, CONFIG.COLUMNS.ADULTS_AUTHORIZED));
  const menoresTotal = inteiroNaoNegativo_(valorDisplay_(contexto, display, CONFIG.COLUMNS.MINORS_AUTHORIZED));
  const adultosEntraram = inteiroNaoNegativo_(valorDisplay_(contexto, display, CONFIG.COLUMNS.ADULTS_ENTERED));
  const menoresEntraram = inteiroNaoNegativo_(valorDisplay_(contexto, display, CONFIG.COLUMNS.MINORS_ENTERED));

  const saldoAdultos = Math.max(0, adultosTotal - adultosEntraram);
  const saldoMenores = Math.max(0, menoresTotal - menoresEntraram);
  const statusEntrada = calcularStatusEntrada_(adultosTotal, menoresTotal, adultosEntraram, menoresEntraram);

  const tipoConvite = valorDisplay_(contexto, display, CONFIG.COLUMNS.INVITATION_TYPE);
  const apoioTexto = valorDisplay_(contexto, display, CONFIG.COLUMNS.NEEDS_SUPPORT);

  return {
    numeroLinha: numeroLinha,
    idQr: normalizarIdQr_(valorDisplay_(contexto, display, CONFIG.COLUMNS.QR_ID)),
    nome: valorDisplay_(contexto, display, CONFIG.COLUMNS.NAME),
    telefone: somenteDigitos_(valorDisplay_(contexto, display, CONFIG.COLUMNS.PHONE)),
    tipoConvite: tipoConvite,
    nomeParticipante: valorDisplay_(contexto, display, CONFIG.COLUMNS.PARTICIPANT_NAME),
    autoridade: CONFIG.AUTHORITY_INVITATION_TYPES.some(function(tipo) {
      return normalizarComparacao_(tipo) === normalizarComparacao_(tipoConvite);
    }),
    precisaApoio: CONFIG.SUPPORT_TRUE_VALUES.some(function(valor) {
      return normalizarComparacao_(valor) === normalizarComparacao_(apoioTexto);
    }),
    apoio: apoioTexto,
    apoioDetalhes: valorDisplay_(contexto, display, CONFIG.COLUMNS.SUPPORT_DETAILS),
    adultosTotal: adultosTotal,
    menoresTotal: menoresTotal,
    adultosEntraram: adultosEntraram,
    menoresEntraram: menoresEntraram,
    saldoAdultos: saldoAdultos,
    saldoMenores: saldoMenores,
    statusEntrada: statusEntrada,
    statusEnvio: valorDisplay_(contexto, display, CONFIG.COLUMNS.SEND_STATUS),
    ultimaEntrada: raw[coluna_(contexto, CONFIG.COLUMNS.LAST_ENTRY) - 1] || '',
    ultimoOperador: valorDisplay_(contexto, display, CONFIG.COLUMNS.LAST_OPERATOR)
  };
}

function localizarLinhaPorIdQr_(contexto, idQr) {
  const colunaId = coluna_(contexto, CONFIG.COLUMNS.QR_ID);
  const lastRow = contexto.sheet.getLastRow();

  if (lastRow < 2) return null;

  const valores = contexto.sheet
    .getRange(2, colunaId, lastRow - 1, 1)
    .getDisplayValues();

  for (let i = 0; i < valores.length; i += 1) {
    if (normalizarIdQr_(valores[i][0]) === idQr) {
      return i + 2;
    }
  }

  return null;
}

function gravarControleLinha_(contexto, numeroLinha, adultosEntraram, menoresEntraram, saldoAdultos, saldoMenores, status, dataHora, operador) {
  const colunas = [
    coluna_(contexto, CONFIG.COLUMNS.ADULTS_ENTERED),
    coluna_(contexto, CONFIG.COLUMNS.MINORS_ENTERED),
    coluna_(contexto, CONFIG.COLUMNS.ADULTS_BALANCE),
    coluna_(contexto, CONFIG.COLUMNS.MINORS_BALANCE),
    coluna_(contexto, CONFIG.COLUMNS.ENTRY_STATUS),
    coluna_(contexto, CONFIG.COLUMNS.LAST_ENTRY),
    coluna_(contexto, CONFIG.COLUMNS.LAST_OPERATOR)
  ];

  validarBlocoOperacionalContiguo_(colunas);

  contexto.sheet
    .getRange(numeroLinha, colunas[0], 1, 7)
    .setValues([[
      adultosEntraram,
      menoresEntraram,
      saldoAdultos,
      saldoMenores,
      status,
      dataHora,
      operador
    ]]);
}

function calcularStatusEntrada_(adultosTotal, menoresTotal, adultosEntraram, menoresEntraram) {
  const totalAutorizado = adultosTotal + menoresTotal;
  const totalEntrou = adultosEntraram + menoresEntraram;
  const saldo = Math.max(0, adultosTotal - adultosEntraram) + Math.max(0, menoresTotal - menoresEntraram);

  if (totalAutorizado <= 0 || saldo <= 0) {
    return CONFIG.ENTRY_STATUS.COMPLETED;
  }

  if (totalEntrou > 0) {
    return CONFIG.ENTRY_STATUS.PARTIAL;
  }

  return CONFIG.ENTRY_STATUS.WAITING;
}

function garantirHistorico_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(CONFIG.SHEETS.HISTORY);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(CONFIG.SHEETS.HISTORY);
  }

  if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) {
    sheet.getRange(1, 1, 1, CONFIG.HISTORY_COLUMNS.length).setValues([CONFIG.HISTORY_COLUMNS]);
    return sheet;
  }

  const existentes = sheet
    .getRange(1, 1, 1, Math.max(sheet.getLastColumn(), CONFIG.HISTORY_COLUMNS.length))
    .getDisplayValues()[0];

  const corretos = CONFIG.HISTORY_COLUMNS.every(function(header, i) {
    return normalizarCabecalho_(existentes[i]) === normalizarCabecalho_(header);
  });

  if (!corretos) {
    throw criarErro_(
      'HISTORICO_CABECALHO_INVALIDO',
      'A aba Historico_Entradas existe, mas os cabeçalhos não correspondem à configuração esperada.'
    );
  }

  return sheet;
}

function registrarHistoricoEntrada_(spreadsheet, registro) {
  const sheet = garantirHistorico_(spreadsheet);
  const linha = CONFIG.HISTORY_COLUMNS.map(function(header) {
    return Object.prototype.hasOwnProperty.call(registro, header) ? registro[header] : '';
  });

  sheet.getRange(sheet.getLastRow() + 1, 1, 1, linha.length).setValues([linha]);
}

function validarBlocoOperacionalContiguo_(colunas) {
  for (let i = 1; i < colunas.length; i += 1) {
    if (colunas[i] !== colunas[i - 1] + 1) {
      throw criarErro_(
        'COLUNAS_OPERACIONAIS_FORA_DE_ORDEM',
        'As colunas de controle de entrada devem permanecer juntas e na ordem configurada.'
      );
    }
  }
}

function coluna_(contexto, nomeCabecalho) {
  const indice = contexto.columnMap[normalizarCabecalho_(nomeCabecalho)];

  if (!indice) {
    throw criarErro_(
      'CABECALHO_NAO_ENCONTRADO',
      'Cabeçalho não encontrado: ' + nomeCabecalho
    );
  }

  return indice;
}

function valorDisplay_(contexto, linhaDisplay, nomeCabecalho) {
  return texto_(linhaDisplay[coluna_(contexto, nomeCabecalho) - 1]);
}

function normalizarCabecalho_(valor) {
  return normalizarComparacao_(valor).replace(/\s+/g, ' ');
}

function normalizarComparacao_(valor) {
  return texto_(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizarAcao_(valor) {
  return normalizarComparacao_(valor)
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

function normalizarIdQr_(valor) {
  return texto_(valor).replace(/\s+/g, '');
}

function somenteDigitos_(valor) {
  return texto_(valor).replace(/\D/g, '');
}

function inteiroNaoNegativo_(valor) {
  const numero = Number(String(valor === null || valor === undefined || valor === '' ? 0 : valor).replace(',', '.'));

  if (!Number.isFinite(numero) || numero < 0) return 0;
  return Math.floor(numero);
}

function texto_(valor) {
  if (valor === null || valor === undefined) return '';
  return String(valor).trim();
}

function lerPayload_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return {};
  }

  try {
    return JSON.parse(e.postData.contents);
  } catch (erro) {
    throw criarErro_('JSON_INVALIDO', 'Não foi possível interpretar os dados enviados.');
  }
}

function criarErro_(code, message) {
  const erro = new Error(message);
  erro.code = code;
  return erro;
}

function respostaErro_(erro) {
  return respostaJson_({
    ok: false,
    error: {
      code: erro && erro.code ? erro.code : 'ERRO_INTERNO',
      message: erro && erro.message ? erro.message : String(erro)
    }
  });
}

function respostaJson_(objeto) {
  return ContentService
    .createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}
