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

    solve(board) {
        let row = -1, col = -1, isEmpty = false;
        for (let i = 0; i < 9; i++) {
            for (let j = 0; j < 9; j++) {
                if (board[i][j] === 0) { row = i; col = j; isEmpty = true; break; }
            }
            if (isEmpty) break;
        }
        if (!isEmpty) return true;
        for (let num = 1; num <= 9; num++) {
            if (this.isValid(board, row, col, num)) {
                board[row][col] = num;
                if (this.solve(board)) return true;
                board[row][col] = 0;
            }
        }
        return false;
    }

    // Count solutions up to `limit`, stopping early once limit is reached.
    // Returns 0 (no solution), 1 (unique), or 2+ (ambiguous).
    countSolutions(board, limit = 2) {
        const copy = board.map(row => [...row]);
        let count = 0;

        const search = () => {
            if (count >= limit) return;
            let row = -1, col = -1;
            outer: for (let r = 0; r < 9; r++) {
                for (let c = 0; c < 9; c++) {
                    if (copy[r][c] === 0) { row = r; col = c; break outer; }
                }
            }
            if (row === -1) { count++; return; }
            for (let num = 1; num <= 9; num++) {
                if (this.isValid(copy, row, col, num)) {
                    copy[row][col] = num;
                    search();
                    copy[row][col] = 0;
                    if (count >= limit) return;
                }
            }
        };

        search();
        return count;
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

    generatePuzzle(difficulty) {
        let removeCount, logicCheck;
        switch (difficulty) {
            case 'easy':
                removeCount = 30;
                // Must be solvable with naked singles only
                logicCheck = grid => this._solveNakedSingles(grid);
                break;
            case 'medium':
                removeCount = 45;
                // Must be solvable with naked + hidden singles
                logicCheck = grid => this._solveNakedAndHiddenSingles(grid);
                break;
            case 'hard':
                removeCount = 55;
                // Unique solution is the only requirement; advanced techniques expected
                logicCheck = null;
                break;
            default:
                removeCount = 40;
                logicCheck = null;
        }

        const maxAttempts = logicCheck ? 50 : 1;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const solved = this.generateSolvedBoard();
            const puzzle = this.removeDigitsWithUniqueness(solved, removeCount);

            if (logicCheck && !logicCheck(puzzle.map(row => [...row]))) continue;

            // Final cross-check: re-solve from scratch and compare to stored solution.
            if (!this.verifySolutionMatch(puzzle, solved)) continue;

            return { solvedData: solved, puzzleData: puzzle };
        }

        // Fallback (rare): last attempt without the logic constraint.
        const solved = this.generateSolvedBoard();
        const puzzle = this.removeDigitsWithUniqueness(solved, removeCount);
        return { solvedData: solved, puzzleData: puzzle };
    }
}
