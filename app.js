document.addEventListener('DOMContentLoaded', () => {
    const MAPPING = {
        1: { char: 'P', colorClass: 'c1' },
        2: { char: 'E', colorClass: 'c2' },
        3: { char: 'R', colorClass: 'c3' },
        4: { char: 'P', colorClass: 'c4' },
        5: { char: 'I', colorClass: 'c5' },
        6: { char: 'G', colorClass: 'c6' },
        7: { char: 'N', colorClass: 'c7' },
        8: { char: 'A', colorClass: 'c8' },
        9: { char: 'N', colorClass: 'c9' }
    };

    const PDF_COLORS = {
        1: [229, 57, 53], 2: [245, 124, 0], 3: [251, 192, 45],
        4: [67, 160, 71], 5: [0, 172, 193], 6: [30, 136, 229],
        7: [57, 73, 171], 8: [142, 36, 170], 9: [216, 27, 96]
    };

    const CANVAS_COLORS = {
        1: '#e53935', 2: '#f57c00', 3: '#fbc02d',
        4: '#43a047', 5: '#00acc1', 6: '#1e88e5',
        7: '#3949ab', 8: '#8e24aa', 9: '#d81b60'
    };

    let generator = new SudokuGenerator();
    let currentSolved = null;
    let currentPuzzle = null;
    let userBoard = null;
    let selectedCell = null;
    let selectedNumber = null;

    // DOM — game
    const boardEl = document.getElementById('board');
    const paletteEl = document.getElementById('palette');
    const btnNewGame = document.getElementById('btn-new-game');
    const difficultySelect = document.getElementById('difficulty');
    const btnCheck = document.getElementById('btn-check');
    const btnHint = document.getElementById('btn-hint');
    const btnErase = document.getElementById('btn-erase');
    const btnExportPng = document.getElementById('btn-export-png');
    const btnExportPdf = document.getElementById('btn-export-pdf');
    const modal = document.getElementById('victory-modal');
    const btnCloseModal = document.getElementById('btn-close-modal');

    // DOM — batch
    const batchEasyInput = document.getElementById('batch-easy');
    const batchMediumInput = document.getElementById('batch-medium');
    const batchHardInput = document.getElementById('batch-hard');
    const batchTotalEl = document.getElementById('batch-total-count');
    const progressContainer = document.getElementById('progress-container');
    const progressFill = document.getElementById('progress-bar-fill');
    const progressLabel = document.getElementById('progress-label');
    const btnBatchPdf = document.getElementById('btn-batch-pdf');
    const btnBatchZip = document.getElementById('btn-batch-zip');

    initPalette();
    startNewGame();

    // Game event listeners
    btnNewGame.addEventListener('click', startNewGame);
    btnCheck.addEventListener('click', checkBoard);
    btnHint.addEventListener('click', giveHint);
    btnErase.addEventListener('click', () => {
        if (selectedCell && !selectedCell.classList.contains('given')) updateCell(selectedCell, 0);
    });
    btnCloseModal.addEventListener('click', () => modal.classList.add('hidden'));
    btnExportPng.addEventListener('click', exportToPng);
    btnExportPdf.addEventListener('click', exportToPdf);
    document.addEventListener('keydown', handleKeyboard);

    // Batch event listeners
    [batchEasyInput, batchMediumInput, batchHardInput].forEach(el =>
        el.addEventListener('input', updateBatchTotal)
    );
    btnBatchPdf.addEventListener('click', exportBatchPdf);
    btnBatchZip.addEventListener('click', exportBatchZip);

    // ─── Single game ─────────────────────────────────────────────────────────

    function startNewGame() {
        const diff = difficultySelect.value;
        const generated = generator.generatePuzzle(diff);
        currentSolved = generated.solvedData;
        currentPuzzle = JSON.parse(JSON.stringify(generated.puzzleData));
        userBoard = JSON.parse(JSON.stringify(generated.puzzleData));
        selectedCell = null;
        renderBoard();
    }

    function initPalette() {
        paletteEl.innerHTML = '';
        for (let i = 1; i <= 9; i++) {
            const btn = document.createElement('div');
            btn.className = `palette-btn ${MAPPING[i].colorClass}`;
            btn.dataset.val = i;
            btn.textContent = MAPPING[i].char;
            btn.addEventListener('click', () => {
                if (btn.classList.contains('active')) {
                    btn.classList.remove('active');
                    selectedNumber = null;
                } else {
                    document.querySelectorAll('.palette-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    selectedNumber = i;
                    if (selectedCell && !selectedCell.classList.contains('given')) {
                        updateCell(selectedCell, selectedNumber);
                    }
                }
            });
            paletteEl.appendChild(btn);
        }
    }

    function renderBoard() {
        boardEl.innerHTML = '';
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const val = userBoard[r][c];
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.r = r;
                cell.dataset.c = c;
                if (currentPuzzle[r][c] !== 0) {
                    cell.classList.add('given');
                    cell.textContent = MAPPING[val].char;
                    cell.classList.add(MAPPING[val].colorClass);
                } else if (val !== 0) {
                    cell.textContent = MAPPING[val].char;
                    cell.classList.add(MAPPING[val].colorClass);
                }
                cell.addEventListener('click', () => onCellClick(cell));
                boardEl.appendChild(cell);
            }
        }
    }

    function onCellClick(cell) {
        document.querySelectorAll('.cell').forEach(c => {
            c.classList.remove('selected', 'error');
        });
        selectedCell = cell;
        cell.classList.add('selected');
        if (selectedNumber !== null && !cell.classList.contains('given')) {
            updateCell(cell, selectedNumber);
        }
    }

    function updateCell(cell, val) {
        const r = parseInt(cell.dataset.r);
        const c = parseInt(cell.dataset.c);
        userBoard[r][c] = val;
        for (let i = 1; i <= 9; i++) cell.classList.remove(MAPPING[i].colorClass);
        cell.classList.remove('error');
        if (val === 0) {
            cell.textContent = '';
        } else {
            cell.textContent = MAPPING[val].char;
            cell.classList.add(MAPPING[val].colorClass);
        }
        checkWinCondition();
    }

    function checkBoard() {
        boardEl.querySelectorAll('.cell').forEach(cell => {
            if (cell.classList.contains('given')) return;
            const r = parseInt(cell.dataset.r);
            const c = parseInt(cell.dataset.c);
            const val = userBoard[r][c];
            cell.classList.remove('error');
            if (val !== 0 && val !== currentSolved[r][c]) {
                cell.classList.add('error');
                setTimeout(() => cell.classList.remove('error'), 500);
            }
        });
    }

    function giveHint() {
        if (!selectedCell || selectedCell.classList.contains('given')) return;
        const r = parseInt(selectedCell.dataset.r);
        const c = parseInt(selectedCell.dataset.c);
        if (userBoard[r][c] !== currentSolved[r][c]) updateCell(selectedCell, currentSolved[r][c]);
    }

    function checkWinCondition() {
        for (let r = 0; r < 9; r++)
            for (let c = 0; c < 9; c++)
                if (userBoard[r][c] !== currentSolved[r][c]) return false;
        setTimeout(() => modal.classList.remove('hidden'), 300);
        return true;
    }

    function handleKeyboard(e) {
        if (!selectedCell || selectedCell.classList.contains('given')) return;
        if (e.key >= '1' && e.key <= '9') {
            updateCell(selectedCell, parseInt(e.key));
        } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0' || e.key === ' ') {
            if (e.key === ' ') e.preventDefault();
            updateCell(selectedCell, 0);
        }
    }

    // ─── Single exports ───────────────────────────────────────────────────────

    async function exportToPng() {
        const captureArea = document.getElementById('capture-area');
        btnExportPng.disabled = true;
        btnExportPng.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Exportation...';
        try {
            if (selectedCell) selectedCell.classList.remove('selected');
            const canvas = await html2canvas(captureArea, { scale: 2, backgroundColor: '#ffffff' });
            const link = document.createElement('a');
            link.download = `Sudoku_Perpignan_${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            if (selectedCell) selectedCell.classList.add('selected');
        } catch (err) {
            console.error(err);
            alert("Erreur lors de l'exportation PNG.");
        } finally {
            btnExportPng.disabled = false;
            btnExportPng.innerHTML = '<i class="fa-solid fa-image"></i> Exporter PNG';
        }
    }

    async function exportToPdf() {
        btnExportPdf.disabled = true;
        btnExportPdf.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Exportation...';
        try {
            await new Promise(r => setTimeout(r, 50)); // Tiny delay for UI
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            
            // Titre
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(24);
            pdf.setTextColor(218, 18, 26);
            pdf.text('Sudoku Perpignan', 105, 30, { align: 'center' });
            
            // Sous-titre difficulté
            const diffSelect = document.getElementById('difficulty');
            const diffText = diffSelect.options[diffSelect.selectedIndex].text;
            pdf.setFontSize(14);
            pdf.setTextColor(100, 100, 100);
            pdf.text(`Niveau : ${diffText}`, 105, 40, { align: 'center' });

            // Dessin de la grille en vectoriel
            const CELL = 16;
            const BOARD = CELL * 9;
            const LEFT = (210 - BOARD) / 2;
            const TOP = 55;
            
            drawGridOnPdf(pdf, userBoard, LEFT, TOP, CELL, false);
            
            // Pied de page
            pdf.setFontSize(10);
            pdf.setTextColor(100, 100, 100);
            pdf.text(`Généré le: ${new Date().toLocaleDateString('fr-FR')}`, 105, TOP + BOARD + 15, { align: 'center' });
            
            pdf.save(`Sudoku_Perpignan_${Date.now()}.pdf`);
        } catch (err) {
            console.error(err);
            alert("Erreur lors de l'exportation PDF.");
        } finally {
            btnExportPdf.disabled = false;
            btnExportPdf.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Exporter PDF';
        }
    }

    // ─── Batch ────────────────────────────────────────────────────────────────

    function updateBatchTotal() {
        const easy = Math.max(0, parseInt(batchEasyInput.value) || 0);
        const medium = Math.max(0, parseInt(batchMediumInput.value) || 0);
        const hard = Math.max(0, parseInt(batchHardInput.value) || 0);
        batchTotalEl.textContent = easy + medium + hard;
    }

    async function generateBatchPuzzles(config, onProgress) {
        const puzzles = [];
        const seen = new Set();
        const specs = [
            { diff: 'easy', label: 'Facile', count: config.easy },
            { diff: 'medium', label: 'Moyen', count: config.medium },
            { diff: 'hard', label: 'Difficile', count: config.hard }
        ];
        const total = config.easy + config.medium + config.hard;
        let done = 0;

        for (const spec of specs) {
            let count = 0;
            let dupStreak = 0;
            while (count < spec.count) {
                await new Promise(r => setTimeout(r, 0));
                const result = generator.generatePuzzle(spec.diff);
                const fp = generator.fingerprint(result.puzzleData);
                if (!seen.has(fp)) {
                    seen.add(fp);
                    puzzles.push({
                        puzzle: result.puzzleData,
                        solved: result.solvedData,
                        difficulty: spec.label,
                        diffKey: spec.diff
                    });
                    count++;
                    done++;
                    dupStreak = 0;
                    onProgress(done, total);
                } else if (++dupStreak > 200) {
                    break;
                }
            }
        }

        // Final verification pass: independently re-solve every puzzle and confirm
        // it matches its stored solution. Rejects any that fail.
        const verified = [];
        for (const p of puzzles) {
            if (generator.verifySolutionMatch(p.puzzle, p.solved)) {
                verified.push(p);
            }
        }

        if (verified.length < puzzles.length) {
            console.warn(`Verification: ${puzzles.length - verified.length} puzzle(s) rejected.`);
        }

        return verified;
    }

    function drawGridOnPdf(pdf, board, startX, startY, cellSize, isAnswer) {
        const boardSize = cellSize * 9;
        for (let i = 0; i <= 9; i++) {
            const isBox = i % 3 === 0;
            pdf.setLineWidth(isBox ? 1.0 : 0.3);
            if (isBox) { pdf.setDrawColor(218, 18, 26); } else { pdf.setDrawColor(180, 180, 180); }
            pdf.line(startX, startY + i * cellSize, startX + boardSize, startY + i * cellSize);
            pdf.line(startX + i * cellSize, startY, startX + i * cellSize, startY + boardSize);
        }
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(cellSize * 1.15); // Responsive font size
        const textOffsetY = cellSize * 0.32; // Responsive vertical centering
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const val = board[r][c];
                if (val !== 0) {
                    const rgb = PDF_COLORS[val];
                    pdf.setTextColor(rgb[0], rgb[1], rgb[2]);
                    pdf.text(
                        MAPPING[val].char,
                        startX + c * cellSize + cellSize / 2,
                        startY + r * cellSize + cellSize / 2 + textOffsetY,
                        { align: 'center' }
                    );
                }
            }
        }
    }

    function setBatchBusy(busy) {
        btnBatchPdf.disabled = busy;
        btnBatchZip.disabled = busy;
        if (busy) {
            progressContainer.classList.remove('hidden');
        } else {
            progressContainer.classList.add('hidden');
            progressFill.style.width = '0%';
        }
    }

    function setProgress(done, total, label) {
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        progressFill.style.width = pct + '%';
        progressLabel.textContent = total > 0
            ? `${label} : ${done}/${total} (${pct}%)`
            : label;
    }

    function getBatchConfig() {
        const easy = Math.min(100, Math.max(0, parseInt(batchEasyInput.value) || 0));
        const medium = Math.min(100, Math.max(0, parseInt(batchMediumInput.value) || 0));
        const hard = Math.min(100, Math.max(0, parseInt(batchHardInput.value) || 0));
        return { easy, medium, hard, total: easy + medium + hard };
    }

    async function exportBatchPdf() {
        const cfg = getBatchConfig();
        if (cfg.total === 0) { alert('Veuillez saisir au moins 1 grille.'); return; }
        if (cfg.total > 500) { alert('Maximum 500 grilles par lot.'); return; }

        setBatchBusy(true);

        try {
            const puzzles = await generateBatchPuzzles(cfg, (done, total) =>
                setProgress(done, total, 'Génération')
            );

            setProgress(0, 1, 'Construction du PDF...');
            await new Promise(r => setTimeout(r, 0));

            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            const date = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
            
            let pageNum = 1;
            const addFooter = () => {
                pdf.setFontSize(10);
                pdf.setTextColor(150, 150, 150);
                pdf.setFont('helvetica', 'normal');
                pdf.text(`Sudoku Perpignan - Page ${pageNum}`, 105, 290, { align: 'center' });
                pageNum++;
            };

            // — Cover Page —
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(40);
            pdf.setTextColor(218, 18, 26);
            pdf.text('Sudoku Perpignan', 105, 80, { align: 'center' });
            
            pdf.setFontSize(20);
            pdf.setTextColor(245, 124, 0);
            pdf.text('Livre de Puzzles', 105, 100, { align: 'center' });

            pdf.setFontSize(14);
            pdf.setTextColor(80, 80, 80);
            pdf.setFont('helvetica', 'normal');
            pdf.text(`Généré le ${date}`, 105, 130, { align: 'center' });
            
            pdf.text(`${puzzles.length} grilles au total :`, 105, 150, { align: 'center' });
            pdf.setFont('helvetica', 'bold');
            let yOffset = 165;
            if (cfg.easy > 0) { pdf.text(`- ${cfg.easy} Facile`, 105, yOffset, { align: 'center' }); yOffset += 10; }
            if (cfg.medium > 0) { pdf.text(`- ${cfg.medium} Moyen`, 105, yOffset, { align: 'center' }); yOffset += 10; }
            if (cfg.hard > 0) { pdf.text(`- ${cfg.hard} Difficile`, 105, yOffset, { align: 'center' }); }
            addFooter();

            // — Puzzle pages (2 per page) —
            const CELL = 12.5; // Reduced from 14.5 to fit 2 perfectly on A4
            const BOARD = CELL * 9; // 112.5 mm
            const LEFT = (210 - BOARD) / 2;

            for (let i = 0; i < puzzles.length; i++) {
                if (i % 2 === 0) {
                    pdf.addPage();
                    addFooter();
                }
                const startY = i % 2 === 0 ? 30 : 165; // Grid 1 at 30 (ends 142.5), Grid 2 at 165
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(14);
                pdf.setTextColor(218, 18, 26);
                pdf.text(`#${i + 1} - ${puzzles[i].difficulty}`, 105, startY - 7, { align: 'center' });
                drawGridOnPdf(pdf, puzzles[i].puzzle, LEFT, startY, CELL, false);
            }

            // — Divider page for Solutions —
            if (puzzles.length > 0) {
                pdf.addPage();
                addFooter();
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(40);
                pdf.setTextColor(43, 130, 65);
                pdf.text('Solutions', 105, 140, { align: 'center' });
            }

            // — Answer pages (4 per page to save paper) —
            const SOL_CELL = 9.5;
            const SOL_BOARD = SOL_CELL * 9;

            for (let i = 0; i < puzzles.length; i++) {
                if (i % 4 === 0) {
                    pdf.addPage();
                    addFooter();
                }
                const col = i % 2;
                const row = Math.floor((i % 4) / 2);
                
                const startX = col === 0 ? 15 : 210 - 15 - SOL_BOARD;
                const startY = row === 0 ? 35 : 160;
                
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(11);
                pdf.setTextColor(43, 130, 65);
                pdf.text(`Solution #${i + 1} - ${puzzles[i].difficulty}`, startX + SOL_BOARD / 2, startY - 5, { align: 'center' });
                drawGridOnPdf(pdf, puzzles[i].solved, startX, startY, SOL_CELL, true);
            }

            // — Quality certificate on last page —
            pdf.addPage();
            addFooter();
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(18);
            pdf.setTextColor(218, 18, 26);
            pdf.text('Certificat de qualité', 105, 40, { align: 'center' });
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(12);
            pdf.setTextColor(40, 40, 40);
            const lines = [
                `Lot généré le ${date}`,
                `${puzzles.length} grilles - ${cfg.easy} Facile - ${cfg.medium} Moyen - ${cfg.hard} Difficile`,
                '',
                '-  Chaque grille possède exactement une solution unique',
                '-  Grilles Facile : résolubles par singles nus uniquement',
                '-  Grilles Moyen : résolubles par singles nus + cachés',
                '-  Grilles Difficile : solution unique, techniques avancées requises',
                '-  Chaque solution vérifiée indépendamment (re-résolution complète)',
                '-  Aucune grille en double dans ce lot',
                '',
                'Généré par Sudoku Perpignan Generator'
            ];
            lines.forEach((line, idx) => {
                pdf.text(line, 105, 60 + idx * 10, { align: 'center' });
            });

            pdf.save(`Sudoku_Perpignan_Lot_${puzzles.length}.pdf`);
            setProgress(puzzles.length, puzzles.length, `✓ ${puzzles.length} grilles vérifiées et exportées`);

        } catch (err) {
            console.error(err);
            alert("Erreur lors de l'exportation PDF.");
        } finally {
            setBatchBusy(false);
        }
    }

    function drawPuzzleCanvas(board, num, diffLabel, isAnswer) {
        const SCALE = 3;
        const CELL = 55;
        const GRID = CELL * 9;
        const MX = 30, MY = 60;
        const W = GRID + MX * 2;
        const H = GRID + MY + MX;

        const canvas = document.createElement('canvas');
        canvas.width = W * SCALE;
        canvas.height = H * SCALE;
        const ctx = canvas.getContext('2d');
        ctx.scale(SCALE, SCALE);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);

        ctx.fillStyle = isAnswer ? '#2b8241' : '#da121a';
        ctx.font = 'bold 20px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
            isAnswer ? `Solution #${num} — ${diffLabel}` : `Puzzle #${num} — ${diffLabel}`,
            W / 2, MY / 2
        );

        const ox = MX, oy = MY;
        for (let i = 0; i <= 9; i++) {
            const isBox = i % 3 === 0;
            ctx.strokeStyle = isBox ? '#da121a' : '#cccccc';
            ctx.lineWidth = isBox ? 2.5 : 0.8;
            ctx.beginPath(); ctx.moveTo(ox, oy + i * CELL); ctx.lineTo(ox + GRID, oy + i * CELL); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(ox + i * CELL, oy); ctx.lineTo(ox + i * CELL, oy + GRID); ctx.stroke();
        }

        ctx.font = `bold ${Math.floor(CELL * 0.55)}px Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const val = board[r][c];
                if (val !== 0) {
                    ctx.fillStyle = CANVAS_COLORS[val];
                    ctx.fillText(MAPPING[val].char, ox + c * CELL + CELL / 2, oy + r * CELL + CELL / 2);
                }
            }
        }
        return canvas;
    }

    function canvasToBlob(canvas) {
        return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    }

    async function exportBatchZip() {
        const cfg = getBatchConfig();
        if (cfg.total === 0) { alert('Veuillez saisir au moins 1 grille.'); return; }
        if (cfg.total > 500) { alert('Maximum 500 grilles par lot.'); return; }

        setBatchBusy(true);

        try {
            const puzzles = await generateBatchPuzzles(cfg, (done, total) =>
                setProgress(done, total, 'Génération')
            );

            setProgress(0, puzzles.length, 'Création des PNG');
            await new Promise(r => setTimeout(r, 0));

            const zip = new JSZip();
            const puzzlesFolder = zip.folder('puzzles');
            const solutionsFolder = zip.folder('solutions');

            for (let i = 0; i < puzzles.length; i++) {
                const p = puzzles[i];
                const num = String(i + 1).padStart(3, '0');

                const pCanvas = drawPuzzleCanvas(p.puzzle, i + 1, p.difficulty, false);
                puzzlesFolder.file(`puzzle_${num}_${p.diffKey}.png`, await canvasToBlob(pCanvas));

                const sCanvas = drawPuzzleCanvas(p.solved, i + 1, p.difficulty, true);
                solutionsFolder.file(`solution_${num}_${p.diffKey}.png`, await canvasToBlob(sCanvas));

                setProgress(i + 1, puzzles.length, 'Création des PNG');
                await new Promise(r => setTimeout(r, 0));
            }

            setProgress(0, 1, 'Compression du ZIP...');
            await new Promise(r => setTimeout(r, 0));

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            saveAs(zipBlob, `Sudoku_Perpignan_Lot_${puzzles.length}.zip`);
            setProgress(puzzles.length, puzzles.length, `✓ ${puzzles.length} grilles vérifiées et exportées`);

        } catch (err) {
            console.error(err);
            alert("Erreur lors de la création du ZIP.");
        } finally {
            setBatchBusy(false);
        }
    }
});
