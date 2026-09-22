// Lookup tables for the bitmask solver: row / column / box index of each of the 81 cells,
// and the number of set bits for every 10-bit candidate mask.
const SUDOKU_ROW = Array.from({ length: 81 }, (_, i) => Math.floor(i / 9));
const SUDOKU_COL = Array.from({ length: 81 }, (_, i) => i % 9);
const SUDOKU_BOX = Array.from({ length: 81 }, (_, i) => Math.floor(i / 27) * 3 + Math.floor((i % 9) / 3));
const SUDOKU_POPCOUNT = Uint8Array.from({ length: 1024 }, (_, m) => {
    let n = 0;
    for (let x = m; x; x &= x - 1) n++;
    return n;
});

// How each difficulty is generated. `remove` is the [min, max] number of cells blanked;
// `attempts` caps how many candidate puzzles are tried to land on the requested level.
const SUDOKU_LEVELS = {
    easy:   { remove: [28, 32], attempts: 100 },
    medium: { remove: [43, 47], attempts: 400 },
    hard:   { remove: [55, 55], attempts: 400 }
};

class SudokuGenerator {
    constructor() {
        this.board = Array(9).fill().map(() => Array(9).fill(0));
    }

    initBoard() {
        this.board = Array(9).fill().map(() => Array(9).fill(0));
    }

    isValid(board, row, col, num) {
        for (let x = 0; x < 9; x++) {
            if (board[row][x] === num) return false;
        }
        for (let x = 0; x < 9; x++) {
            if (board[x][col] === num) return false;
        }
        const startRow = row - row % 3;
        const startCol = col - col % 3;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                if (board[i + startRow][j + startCol] === num) return false;
            }
        }
        return true;
    }

    // Backtracking search over a flat 81-cell grid using bitmasks and the
    // "fewest candidates first" heuristic. Stops once `limit` solutions are found.
    // Returns { count, first } where `first` is the first solution found (or null).
    _search(grid, limit) {
        const rows = new Int16Array(9), cols = new Int16Array(9), boxes = new Int16Array(9);
        for (let i = 0; i < 81; i++) {
            const v = grid[i];
            if (!v) continue;
            const bit = 1 << v;
            if ((rows[SUDOKU_ROW[i]] | cols[SUDOKU_COL[i]] | boxes[SUDOKU_BOX[i]]) & bit) {
                return { count: 0, first: null }; // conflicting givens
            }
            rows[SUDOKU_ROW[i]] |= bit;
            cols[SUDOKU_COL[i]] |= bit;
            boxes[SUDOKU_BOX[i]] |= bit;
        }

        let count = 0;
        let first = null;

        const dfs = () => {
            let best = -1, bestMask = 0, bestN = 10;
            for (let i = 0; i < 81; i++) {
                if (grid[i]) continue;
                const mask = ~(rows[SUDOKU_ROW[i]] | cols[SUDOKU_COL[i]] | boxes[SUDOKU_BOX[i]]) & 0x3FE;
                const n = SUDOKU_POPCOUNT[mask];
                if (n < bestN) {
                    best = i; bestMask = mask; bestN = n;
                    if (n <= 1) break;
                }
            }
            if (best === -1) {
                count++;
                if (!first) first = grid.slice();
                return;
            }
            if (bestN === 0) return;

            const r = SUDOKU_ROW[best], c = SUDOKU_COL[best], b = SUDOKU_BOX[best];
            for (let m = bestMask; m && count < limit; m &= m - 1) {
                const bit = m & -m;
                grid[best] = 31 - Math.clz32(bit);
                rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
                dfs();
                grid[best] = 0;
                rows[r] &= ~bit; cols[c] &= ~bit; boxes[b] &= ~bit;
            }
        };

        dfs();
        return { count, first };
    }

    // Solve `board` in place. Returns false if it has no solution.
    solve(board) {
        const { first } = this._search(board.flat(), 1);
        if (!first) return false;
        for (let r = 0; r < 9; r++)
            for (let c = 0; c < 9; c++)
                board[r][c] = first[r * 9 + c];
        return true;
    }

    // Count solutions up to `limit`, stopping early once limit is reached.
    // Returns 0 (no solution), 1 (unique), or 2+ (ambiguous).
    countSolutions(board, limit = 2) {
        return this._search(board.flat(), limit).count;
    }

    fillDiagonal() {
        for (let i = 0; i < 9; i += 3) this.fillBox(i, i);
    }

    fillBox(rowStart, colStart) {
        let num;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                do { num = this.randomGenerator(9); }
                while (!this.unUsedInBox(rowStart, colStart, num));
                this.board[rowStart + i][colStart + j] = num;
            }
        }
    }

    randomGenerator(num) {
        return Math.floor(Math.random() * num + 1);
    }

    unUsedInBox(rowStart, colStart, num) {
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                if (this.board[rowStart + i][colStart + j] === num) return false;
            }
        }
        return true;
    }

    generateSolvedBoard() {
        this.initBoard();
        this.fillDiagonal();
        this.solve(this.board);
        return JSON.parse(JSON.stringify(this.board));
    }

    // Remove up to K cells from a solved board, retaining a unique solution.
    // Tries cells in random order; skips any removal that would create ambiguity.
    removeDigitsWithUniqueness(solved, K) {
        const board = solved.map(row => [...row]);
        const positions = [];
        for (let r = 0; r < 9; r++)
            for (let c = 0; c < 9; c++)
                positions.push([r, c]);

        for (let i = positions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [positions[i], positions[j]] = [positions[j], positions[i]];
        }

        let removed = 0;
        for (const [r, c] of positions) {
            if (removed >= K) break;
            const backup = board[r][c];
            board[r][c] = 0;
            if (this.countSolutions(board) === 1) {
                removed++;
            } else {
                board[r][c] = backup;
            }
        }

        return board;
    }

    // Returns the 81-character string of the puzzle's givens (0 for blanks).
    fingerprint(board) {
        return board.flat().join('');
    }

    // Solve using ONLY naked singles (one candidate in a cell).
    // Returns true if the puzzle is fully solved this way — the bar for "Easy".
    _solveNakedSingles(grid) {
        let changed = true;
        while (changed) {
            changed = false;
            for (let r = 0; r < 9; r++) {
                for (let c = 0; c < 9; c++) {
                    if (grid[r][c] !== 0) continue;
                    const candidates = [];
                    for (let n = 1; n <= 9; n++) {
                        if (this.isValid(grid, r, c, n)) candidates.push(n);
                    }
                    if (candidates.length === 0) return false; // contradiction
                    if (candidates.length === 1) { grid[r][c] = candidates[0]; changed = true; }
                }
            }
        }
        return grid.flat().every(v => v !== 0);
    }

    // Solve using naked singles + hidden singles (a value that fits only one cell
    // in a row, column, or box). Returns true if fully solved — the bar for "Medium".
    _solveNakedAndHiddenSingles(grid) {
        let changed = true;
        while (changed) {
            changed = false;

            // Naked singles
            for (let r = 0; r < 9; r++) {
                for (let c = 0; c < 9; c++) {
                    if (grid[r][c] !== 0) continue;
                    const candidates = [];
                    for (let n = 1; n <= 9; n++) {
                        if (this.isValid(grid, r, c, n)) candidates.push(n);
                    }
                    if (candidates.length === 0) return false;
                    if (candidates.length === 1) { grid[r][c] = candidates[0]; changed = true; }
                }
            }

            // Hidden singles — rows
            for (let r = 0; r < 9; r++) {
                for (let n = 1; n <= 9; n++) {
                    if (grid[r].includes(n)) continue;
                    const places = [];
                    for (let c = 0; c < 9; c++) {
                        if (grid[r][c] === 0 && this.isValid(grid, r, c, n)) places.push(c);
                    }
                    if (places.length === 0) return false;
                    if (places.length === 1) { grid[r][places[0]] = n; changed = true; }
                }
            }

            // Hidden singles — columns
            for (let c = 0; c < 9; c++) {
                for (let n = 1; n <= 9; n++) {
                    const inCol = grid.some(row => row[c] === n);
                    if (inCol) continue;
                    const places = [];
                    for (let r = 0; r < 9; r++) {
                        if (grid[r][c] === 0 && this.isValid(grid, r, c, n)) places.push(r);
                    }
                    if (places.length === 0) return false;
                    if (places.length === 1) { grid[places[0]][c] = n; changed = true; }
                }
            }

            // Hidden singles — 3×3 boxes
            for (let br = 0; br < 3; br++) {
                for (let bc = 0; bc < 3; bc++) {
                    for (let n = 1; n <= 9; n++) {
                        let inBox = false;
                        for (let i = 0; i < 3 && !inBox; i++)
                            for (let j = 0; j < 3 && !inBox; j++)
                                if (grid[br * 3 + i][bc * 3 + j] === n) inBox = true;
                        if (inBox) continue;
                        const places = [];
                        for (let i = 0; i < 3; i++) {
                            for (let j = 0; j < 3; j++) {
                                const r = br * 3 + i, c = bc * 3 + j;
                                if (grid[r][c] === 0 && this.isValid(grid, r, c, n))
                                    places.push([r, c]);
                            }
                        }
                        if (places.length === 0) return false;
                        if (places.length === 1) {
                            grid[places[0][0]][places[0][1]] = n;
                            changed = true;
                        }
                    }
                }
            }
        }
        return grid.flat().every(v => v !== 0);
    }

    // The easiest level whose techniques are enough to solve the puzzle:
    //   'easy'   — naked singles only
    //   'medium' — naked + hidden singles
    //   'hard'   — anything else (needs more than singles)
    levelOf(puzzle) {
        const copy = () => puzzle.map(row => [...row]);
        if (this._solveNakedSingles(copy())) return 'easy';
        if (this._solveNakedAndHiddenSingles(copy())) return 'medium';
        return 'hard';
    }

    // Independently solve the puzzle from scratch and confirm it matches the
    // stored solution. Catches any mismatch between puzzleData and solvedData.
    verifySolutionMatch(puzzle, solution) {
        const board = puzzle.map(row => [...row]);
        if (!this.solve(board)) return false;
        for (let r = 0; r < 9; r++)
            for (let c = 0; c < 9; c++)
                if (board[r][c] !== solution[r][c]) return false;
        return true;
    }

    // Returns { solvedData, puzzleData, levelMet }. `levelMet` is false only if no
    // puzzle of the requested level was found within the attempt budget; the
    // returned puzzle still has a unique solution in that case.
    generatePuzzle(difficulty) {
        const level = SUDOKU_LEVELS[difficulty];
        const [minRemove, maxRemove] = level ? level.remove : [40, 40];
        const attempts = level ? level.attempts : 1;

        let last = null;
        for (let attempt = 0; attempt < attempts; attempt++) {
            const removeCount = minRemove + Math.floor(Math.random() * (maxRemove - minRemove + 1));
            const solved = this.generateSolvedBoard();
            const puzzle = this.removeDigitsWithUniqueness(solved, removeCount);

            // Cross-check: re-solve from scratch and compare to the stored solution.
            if (!this.verifySolutionMatch(puzzle, solved)) continue;

            last = { solvedData: solved, puzzleData: puzzle };
            if (!level || this.levelOf(puzzle) === difficulty) {
                return { ...last, levelMet: true };
            }
        }

        if (last) return { ...last, levelMet: false };

        // Only reachable if every attempt failed cross-verification (should never happen).
        const solved = this.generateSolvedBoard();
        return {
            solvedData: solved,
            puzzleData: this.removeDigitsWithUniqueness(solved, minRemove),
            levelMet: false
        };
    }
}

if (typeof module !== 'undefined' && module.exports) module.exports = SudokuGenerator;
