// Every table, in menu order. A table in the workshop (`workshop: true`) is listed below the others, as a
// test table rather than one to play.
import funfair from './funfair/config.js';
import parts from './parts/config.js';
import test from './test/config.js';

export const tables = [funfair, parts, test];
export const tableIds = tables.map(t => t.id);
