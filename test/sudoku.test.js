const test = require('node:test');
const assert = require('node:assert/strict');
const SudokuGenerator = require('../sudoku.js');

const g = new SudokuGenerator();
const RUNS = 25;
const copy = board => board.map(row => [...row]);
const givens = board => board.flat().filter(Boolean).length;

test('solver finds a valid completed grid', () => {
    const solved = g.generateSolvedBoard();
    for (let i = 0; i < 9; i++) {
        assert.deepEqual([...solved[i]].sort(), [1, 2, 3, 4, 5, 6, 7, 8, 9], `row ${i}`);
        assert.deepEqual(solved.map(r => r[i]).sort(), [1, 2, 3, 4, 5, 6, 7, 8, 9], `column ${i}`);
    }
    assert.equal(g.countSolutions(solved), 1);
});

test('countSolutions reports 0, 1 and 2+', () => {
    const solved = g.generateSolvedBoard();

    const unique = copy(solved);
    unique[0][0] = 0;
    assert.equal(g.countSolutions(unique), 1);

    assert.equal(g.countSolutions(Array.from({ length: 9 }, () => Array(9).fill(0))), 2); // capped at limit

    const conflicting = copy(solved);
    conflicting[0][0] = conflicting[0][1]; // duplicate in a row
    assert.equal(g.countSolutions(conflicting), 0);
});

for (const difficulty of ['easy', 'medium', 'hard']) {
    test(`${difficulty}: unique solution, matches stored solution, level respected`, () => {
        for (let i = 0; i < RUNS; i++) {
            const { puzzleData, solvedData, levelMet } = g.generatePuzzle(difficulty);
            assert.equal(levelMet, true, 'generator should reach the requested level');
            assert.equal(g.countSolutions(puzzleData), 1, 'exactly one solution');
            assert.ok(g.verifySolutionMatch(puzzleData, solvedData), 'solution matches');
            assert.equal(g.levelOf(puzzleData), difficulty);
            // givens are a subset of the solution
            puzzleData.forEach((row, r) => row.forEach((v, c) => {
                if (v) assert.equal(v, solvedData[r][c]);
            }));
        }
    });
}

test('difficulty levels are ordered by technique, not just clue count', () => {
    const easy = g.generatePuzzle('easy').puzzleData;
    const hard = g.generatePuzzle('hard').puzzleData;
    assert.ok(g._solveNakedSingles(copy(easy)), 'easy: naked singles are enough');
    assert.ok(!g._solveNakedAndHiddenSingles(copy(hard)), 'hard: singles are not enough');
    assert.ok(givens(hard) < givens(easy));
});

test('generated puzzles are distinct', () => {
    const seen = new Set();
    for (let i = 0; i < RUNS; i++) seen.add(g.fingerprint(g.generatePuzzle('medium').puzzleData));
    assert.equal(seen.size, RUNS);
});
