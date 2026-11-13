// Every table, in menu order. A table in the workshop (`workshop: true`) is listed below the others, as a
// test table rather than one to play.
// Fergus and Angry Andy (team in-joke tables) are kept in tables/ but left out of the menu and the build.
import funfair from './funfair/config.js';
import raceday from './raceday/config.js';
import highnoon from './highnoon/config.js';
import cupfinal from './cupfinal/config.js';
import starsiege from './starsiege/config.js';
import holeinone from './holeinone/config.js';
import grandslam from './grandslam/config.js';
import parts from './parts/config.js';
import test from './test/config.js';

export const tables = [funfair, raceday, highnoon, cupfinal, starsiege, holeinone, grandslam, parts, test];
export const tableIds = tables.map(t => t.id);
