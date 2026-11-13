// Every table, in menu order. A table in the workshop (`workshop: true`) is listed below the others, as a
// test table rather than one to play.
import funfair from './funfair/config.js';
import raceday from './raceday/config.js';
import highnoon from './highnoon/config.js';
import cupfinal from './cupfinal/config.js';
import starsiege from './starsiege/config.js';
import holeinone from './holeinone/config.js';
import fergus from './fergus/config.js';
import angryandy from './angryandy/config.js';
import parts from './parts/config.js';
import test from './test/config.js';

export const tables = [funfair, raceday, highnoon, cupfinal, starsiege, holeinone, fergus, angryandy, parts, test];
export const tableIds = tables.map(t => t.id);
