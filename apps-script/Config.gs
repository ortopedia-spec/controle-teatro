/**
 * ============================================================================
 * CONFIGURAÇÕES — CONTROLE DE ENTRADA DO TEATRO
 * ============================================================================
 *
 * Projeto:
 * Controle de entrada — Festival de Música 2026
 *
 * Objetivo:
 * Centralizar a estrutura da planilha, os cabeçalhos e as regras operacionais
 * utilizadas pelo front-end e pelo Google Apps Script.
 *
 * Regra principal:
 * - O convite é identificado por ID_QR.
 * - Adultos e menores possuem saldos independentes.
 * - Entradas podem ser parciais.
 * - STATUS_ENTRADA é calculado como AGUARDANDO, PARCIAL ou CONCLUIDO.
 * - O histórico registra cada operação separadamente.
 * ============================================================================
 */

const CONFIG = Object.freeze({
  /**
   * Planilha oficial do Festival de Música.
   */
  SPREADSHEET_ID: '1NvcCxpYPCY26r8O7Ba1NKn-kAa9JEw66zIol96Ah8Ic',

  /**
   * ID interno da aba principal informada na URL (gid).
   * Usamos o ID para não depender do nome da aba.
   */
  INVITATIONS_SHEET_ID: 727574156,

  /**
   * Abas auxiliares.
   */
  SHEETS: Object.freeze({
    HISTORY: 'Historico_Entradas'
  }),

  /**
   * Cabeçalhos originais da planilha de convites.
   */
  COLUMNS: Object.freeze({
    TIMESTAMP: 'Carimbo de data/hora',
    NAME: 'Nome completo para a entrada no teatro',
    PHONE: 'Telefonecelularcomwhatsapp',
    INVITATION_TYPE: 'Tipo de convite',
    PARTICIPANT_NAME: 'Nome do usuário participante da peça',
    ADULTS_AUTHORIZED: 'Quantidade de convite adulto (13 anos ou mais)',
    MINORS_AUTHORIZED: 'Quantidade de convite Menor de 12 anos',
    NEEDS_SUPPORT: 'Você ou algum convidado precisa de adaptação ou apoio para aproveitar o evento?\n(Ex: rampa, elevador, intérprete de Libras,...)',
    SUPPORT_DETAILS: 'Escreva o tipo de adaptação ou apoio necessário para aproveitar o evento?',
    QR_ID: 'ID_QR',
    SEND_STATUS: 'STATUS_ENVIO',

    ADULTS_ENTERED: 'QTD_ENTRADA_ADULTO',
    MINORS_ENTERED: 'QTD_ENTRADA_MENOR',
    ADULTS_BALANCE: 'SALDO_ADULTO',
    MINORS_BALANCE: 'SALDO_MENOR',
    ENTRY_STATUS: 'STATUS_ENTRADA',
    LAST_ENTRY: 'ULTIMA_ENTRADA',
    LAST_OPERATOR: 'ULTIMO_OPERADOR'
  }),

  /**
   * Status operacionais da entrada.
   */
  ENTRY_STATUS: Object.freeze({
    WAITING: 'AGUARDANDO',
    PARTIAL: 'PARCIAL',
    COMPLETED: 'CONCLUIDO'
  }),

  /**
   * Valores que indicam necessidade de adaptação/apoio.
   */
  SUPPORT_TRUE_VALUES: Object.freeze([
    'SIM',
    'S',
    'TRUE',
    'VERDADEIRO',
    '1'
  ]),

  /**
   * Tipos de convite que devem receber destaque visual de autoridade/parceiro.
   */
  AUTHORITY_INVITATION_TYPES: Object.freeze([
    'AUTORIDADE OU PARCEIRO DA SORRI'
  ]),

  /**
   * Configurações de busca manual.
   */
  SEARCH: Object.freeze({
    DEFAULT_ONLY_OPEN: true,
    MAX_RESULTS: 100
  }),

  /**
   * Proteção contra duas portarias registrarem o mesmo saldo ao mesmo tempo.
   */
  LOCK_TIMEOUT_MS: 10000,

  /**
   * Operador padrão até definirmos identificação por dispositivo/portaria.
   */
  DEFAULT_OPERATOR: 'Portaria 01',

  /**
   * Cabeçalhos da aba Historico_Entradas.
   */
  HISTORY_COLUMNS: Object.freeze([
    'DATA_HORA',
    'ID_QR',
    'NOME',
    'TELEFONE',
    'TIPO_CONVITE',
    'ADULTOS_ENTRADA',
    'MENORES_ENTRADA',
    'ADULTOS_ENTRADA_ANTES',
    'MENORES_ENTRADA_ANTES',
    'SALDO_ADULTO_APOS',
    'SALDO_MENOR_APOS',
    'STATUS_ENTRADA_APOS',
    'OPERADOR',
    'ID_OPERACAO'
  ])
});
