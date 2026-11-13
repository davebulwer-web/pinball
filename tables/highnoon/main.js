import config from './config.js';
import { startTable } from '../../ui/shell.js';
import { loadArt } from '../../ui/art.js';
loadArt().then(art => startTable(config, { art }));
