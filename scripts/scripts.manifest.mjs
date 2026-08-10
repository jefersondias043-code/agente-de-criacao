// FONTE ÚNICA da ordem de carregamento dos módulos de src/.
// Editar AQUI e rodar `npm run sync:manifest` regenera os blocos marcados em
// index.html (<script>) e service-worker.js (URLS). Elimina o drift manual que
// quebrava o boot (função undefined) ou servia cache obsoleto.
// Ordem = dependência (app.js por último faz o boot).
export const SCRIPTS = [
  'catalogs.js',
  'core.js',
  'clear-field.js',
  'crypto.js',
  'storage.js',
  'apikey-sync.js',
  'lock.js',
  'llm.js',
  'agents.js',
  'generate.js',
  'narrativa.js',
  'narrativa-motor.js',
  'causos-motor.js',
  'causos.js',
  'extract.js',
  'posters.js',
  'poster-templates.js',
  'carousels.js',
  'poster-elements.js',
  'poster-typeset.js',
  'poster-editor-pro.js',
  'history.js',
  'settings.js',
  'detector.js',
  'autopost.js',
  'replicador.js',
  'removedor.js',
  'handoff.js',
  'media-transcode.js',
  'ingest.js',
  'app.js',
];
