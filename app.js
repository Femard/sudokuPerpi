document.addEventListener('DOMContentLoaded', () => {
    const MAPPING = {
        1: { char: 'P', colorClass: 'c1', colorName: 'rouge' },
        2: { char: 'E', colorClass: 'c2', colorName: 'orange' },
        3: { char: 'R', colorClass: 'c3', colorName: 'jaune' },
        4: { char: 'P', colorClass: 'c4', colorName: 'vert' },
        5: { char: 'I', colorClass: 'c5', colorName: 'turquoise' },
        6: { char: 'G', colorClass: 'c6', colorName: 'bleu' },
        7: { char: 'N', colorClass: 'c7', colorName: 'indigo' },
        8: { char: 'A', colorClass: 'c8', colorName: 'violet' },
        9: { char: 'N', colorClass: 'c9', colorName: 'rose' }
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
    let tabStopCell = null; // the one cell reachable with Tab (roving tabindex)
    let won = false;
    let victoryTimer = null;
    let modalOpener = null;

    // DOM — game
    const boardEl = document.getElementById('board');
    const statusEl = document.getElementById('status');
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

    // DOM — PDF format
    const pdfPageSizeSel = document.getElementById('pdf-page-size');
    const pdfPuzzlesPerPageSel = document.getElementById('pdf-puzzles-per-page');
    const pdfSolutionsPerPageSel = document.getElementById('pdf-solutions-per-page');
    const pdfGutterInput = document.getElementById('pdf-gutter');
    const pdfMirrorChk = document.getElementById('pdf-mirror');
    const pdfFormatHint = document.getElementById('pdf-format-hint');

    initPalette();
    startNewGame();

    // Game event listeners
    btnNewGame.addEventListener('click', startNewGame);
    btnCheck.addEventListener('click', checkBoard);
    btnHint.addEventListener('click', giveHint);
    btnErase.addEventListener('click', () => {
        if (selectedCell && !selectedCell.classList.contains('given')) updateCell(selectedCell, 0);
    });
    btnCloseModal.addEventListener('click', closeVictoryModal);
    btnExportPng.addEventListener('click', exportToPng);
    btnExportPdf.addEventListener('click', exportToPdf);
    document.addEventListener('keydown', handleKeyboard);

    // Batch event listeners
    [batchEasyInput, batchMediumInput, batchHardInput].forEach(el =>
        el.addEventListener('input', updateBatchTotal)
    );
    btnBatchPdf.addEventListener('click', exportBatchPdf);
    btnBatchZip.addEventListener('click', exportBatchZip);

    // PDF format listeners
    [pdfPageSizeSel, pdfPuzzlesPerPageSel, pdfSolutionsPerPageSel, pdfMirrorChk].forEach(el =>
        el.addEventListener('change', updatePdfFormatHint)
    );
    pdfGutterInput.addEventListener('input', updatePdfFormatHint);
    pdfGutterInput.addEventListener('change', () => {
        pdfGutterInput.value = PdfLayout.clampGutter(pdfGutterInput.value); // never below 12.7 mm
        updatePdfFormatHint();
    });
    updatePdfFormatHint();

    // ─── Single game ─────────────────────────────────────────────────────────

    function startNewGame() {
        const diff = difficultySelect.value;
        const generated = generator.generatePuzzle(diff);
        currentSolved = generated.solvedData;
        currentPuzzle = JSON.parse(JSON.stringify(generated.puzzleData));
        userBoard = JSON.parse(JSON.stringify(generated.puzzleData));
        selectedCell = null;
        won = false;
        clearTimeout(victoryTimer);
        modal.classList.add('hidden');
        setStatus('');
        renderBoard();
    }

    function setStatus(message) {
        statusEl.textContent = message;
    }

    function initPalette() {
        paletteEl.innerHTML = '';
        for (let i = 1; i <= 9; i++) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `palette-btn ${MAPPING[i].colorClass}`;
            btn.dataset.val = i;
            btn.textContent = MAPPING[i].char;
            btn.setAttribute('aria-label', `Lettre ${MAPPING[i].char} ${MAPPING[i].colorName}`);
            btn.setAttribute('aria-pressed', 'false');
            btn.addEventListener('click', () => {
                if (btn.classList.contains('active')) {
                    btn.classList.remove('active');
                    btn.setAttribute('aria-pressed', 'false');
                    selectedNumber = null;
                } else {
                    document.querySelectorAll('.palette-btn').forEach(b => {
                        b.classList.remove('active');
                        b.setAttribute('aria-pressed', 'false');
                    });
                    btn.classList.add('active');
                    btn.setAttribute('aria-pressed', 'true');
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
        tabStopCell = null;
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const val = userBoard[r][c];
                const cell = document.createElement('button');
                cell.type = 'button';
                cell.className = 'cell';
                cell.dataset.r = r;
                cell.dataset.c = c;
                cell.tabIndex = -1;
                if (currentPuzzle[r][c] !== 0) {
                    cell.classList.add('given');
                    cell.textContent = MAPPING[val].char;
                    cell.classList.add(MAPPING[val].colorClass);
                } else if (val !== 0) {
                    cell.textContent = MAPPING[val].char;
                    cell.classList.add(MAPPING[val].colorClass);
                }
                updateCellLabel(cell);
                cell.addEventListener('click', () => onCellClick(cell));
                cell.addEventListener('focus', () => selectCell(cell));
                boardEl.appendChild(cell);
            }
        }
        tabStopCell = boardEl.firstElementChild;
        tabStopCell.tabIndex = 0;
    }

    // Screen-reader description. The colour is part of it because two letters
    // (P and N) each appear twice and are told apart by colour only.
    function updateCellLabel(cell) {
        const r = parseInt(cell.dataset.r);
        const c = parseInt(cell.dataset.c);
        const val = userBoard[r][c];
        const content = val === 0 ? 'vide' : `lettre ${MAPPING[val].char} ${MAPPING[val].colorName}`;
        const given = cell.classList.contains('given') ? ', case donnée' : '';
        cell.setAttribute('aria-label', `Ligne ${r + 1}, colonne ${c + 1}, ${content}${given}`);
    }

    function selectCell(cell) {
        boardEl.querySelectorAll('.cell.selected, .cell.error').forEach(c => {
            c.classList.remove('selected', 'error');
        });
        if (tabStopCell) tabStopCell.tabIndex = -1;
        cell.tabIndex = 0;
        tabStopCell = cell;
        selectedCell = cell;
        cell.classList.add('selected');
    }

    function onCellClick(cell) {
        selectCell(cell);
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
        updateCellLabel(cell);
        checkWinCondition();
    }

    function checkBoard() {
        let errors = 0;
        boardEl.querySelectorAll('.cell').forEach(cell => {
            if (cell.classList.contains('given')) return;
            const r = parseInt(cell.dataset.r);
            const c = parseInt(cell.dataset.c);
            const val = userBoard[r][c];
            cell.classList.remove('error');
            if (val !== 0 && val !== currentSolved[r][c]) {
                errors++;
                cell.classList.add('error');
                setTimeout(() => cell.classList.remove('error'), 500);
            }
        });
        setStatus(errors === 0
            ? 'Aucune erreur détectée.'
            : `${errors} case${errors > 1 ? 's' : ''} incorrecte${errors > 1 ? 's' : ''}.`);
    }

    function giveHint() {
        if (!selectedCell || selectedCell.classList.contains('given')) {
            setStatus('Sélectionnez d’abord une case vide.');
            return;
        }
        const r = parseInt(selectedCell.dataset.r);
        const c = parseInt(selectedCell.dataset.c);
        if (userBoard[r][c] !== currentSolved[r][c]) updateCell(selectedCell, currentSolved[r][c]);
    }

    function checkWinCondition() {
        if (won) return true;
        for (let r = 0; r < 9; r++)
            for (let c = 0; c < 9; c++)
                if (userBoard[r][c] !== currentSolved[r][c]) return false;
        won = true;
        setStatus('Bravo, la grille est complète !');
        victoryTimer = setTimeout(openVictoryModal, 300);
        return true;
    }

    function openVictoryModal() {
        modalOpener = document.activeElement;
        modal.classList.remove('hidden');
        btnCloseModal.focus();
    }

    function closeVictoryModal() {
        modal.classList.add('hidden');
        if (modalOpener && document.contains(modalOpener)) modalOpener.focus();
        modalOpener = null;
    }

    function moveSelection(dr, dc) {
        const r = Math.min(8, Math.max(0, parseInt(selectedCell.dataset.r) + dr));
        const c = Math.min(8, Math.max(0, parseInt(selectedCell.dataset.c) + dc));
        boardEl.children[r * 9 + c].focus(); // the focus handler selects it
    }

    const ARROWS = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };

    function handleKeyboard(e) {
        if (!modal.classList.contains('hidden')) {
            if (e.key === 'Escape') closeVictoryModal();
            else if (e.key === 'Tab') { e.preventDefault(); btnCloseModal.focus(); } // keep focus in the dialog
            return;
        }
        if (!selectedCell) return;
        if (ARROWS[e.key]) {
            e.preventDefault();
            moveSelection(...ARROWS[e.key]);
            return;
        }
        if (selectedCell.classList.contains('given')) return;
        if (e.key >= '1' && e.key <= '9') {
            updateCell(selectedCell, parseInt(e.key));
        } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
            updateCell(selectedCell, 0);
        } else if (e.key === ' ' && e.target === selectedCell) {
            e.preventDefault(); // erase instead of re-clicking the cell
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
        } catch (err) {
            console.error(err);
            alert("Erreur lors de l'exportation PNG.");
        } finally {
            if (selectedCell) selectedCell.classList.add('selected');
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
            
            drawGridOnPdf(pdf, userBoard, LEFT, TOP, CELL);
            
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
            let rejectStreak = 0; // consecutive duplicates / off-level puzzles
            while (count < spec.count) {
                await new Promise(r => setTimeout(r, 0));
                const result = generator.generatePuzzle(spec.diff);
                const fp = generator.fingerprint(result.puzzleData);
                if (result.levelMet && !seen.has(fp)) {
                    seen.add(fp);
                    puzzles.push({
                        puzzle: result.puzzleData,
                        solved: result.solvedData,
                        difficulty: spec.label,
                        diffKey: spec.diff
                    });
                    count++;
                    done++;
                    rejectStreak = 0;
                    onProgress(done, total);
                } else if (++rejectStreak > 200) {
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

    // Draw a sudoku grid. Thin grey inner lines are painted first so the thick red
    // box borders (drawn second) are never obscured. baseline:'middle' centers each
    // letter exactly in its cell — no manual offset needed.
    function drawGridOnPdf(pdf, board, left, top, cellSize) {
        const size = cellSize * 9;

        // Pass 1 — thin grey inner lines (skip box boundaries)
        pdf.setLineWidth(0.25);
        pdf.setDrawColor(190, 190, 190);
        for (let i = 1; i <= 8; i++) {
            if (i % 3 === 0) continue;
            pdf.line(left, top + i * cellSize, left + size, top + i * cellSize);
            pdf.line(left + i * cellSize, top, left + i * cellSize, top + size);
        }

        // Pass 2 — thick red box borders and outer frame on top
        pdf.setLineWidth(PdfLayout.GRID_LINE);
        pdf.setDrawColor(218, 18, 26);
        for (let i = 0; i <= 9; i += 3) {
            pdf.line(left, top + i * cellSize, left + size, top + i * cellSize);
            pdf.line(left + i * cellSize, top, left + i * cellSize, top + size);
        }

        // Letters — baseline:'middle' places the glyph center at (cx, cy) exactly
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(cellSize * 1.15);
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const val = board[r][c];
                if (val !== 0) {
                    const rgb = PDF_COLORS[val];
                    pdf.setTextColor(rgb[0], rgb[1], rgb[2]);
                    pdf.text(
                        MAPPING[val].char,
                        left + c * cellSize + cellSize / 2,
                        top  + r * cellSize + cellSize / 2,
                        { align: 'center', baseline: 'middle' }
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

    // ─── PDF format ───────────────────────────────────────────────────────────

    function getPdfFormat() {
        const perPage = el => [1, 2, 4].includes(parseInt(el.value)) ? parseInt(el.value) : 2;
        return {
            page: PdfLayout.PAGE_SIZES[pdfPageSizeSel.value] || PdfLayout.PAGE_SIZES.a4,
            puzzlesPerPage: perPage(pdfPuzzlesPerPageSel),
            solutionsPerPage: perPage(pdfSolutionsPerPageSel),
            gutter: PdfLayout.clampGutter(pdfGutterInput.value),
            mirror: pdfMirrorChk.checked
        };
    }

    // Shows the resulting cell size and warns when letters would be too small to read.
    function updatePdfFormatHint() {
        const f = getPdfFormat();
        const cell = perPage => PdfLayout.cellSize(f.page.w, f.page.h, f.gutter, perPage);
        const puzzles = cell(f.puzzlesPerPage);
        const solutions = cell(f.solutionsPerPage);
        const fmt = mm => mm.toFixed(1).replace('.', ',');
        const tooSmall = Math.min(puzzles, solutions) < PdfLayout.MIN_LEGIBLE_CELL;
        pdfFormatHint.textContent = `Cases : ${fmt(puzzles)} mm (puzzles), ${fmt(solutions)} mm (solutions)`
            + (tooSmall ? ' — lettres très petites, réduisez le nombre de grilles par page ou agrandissez le format.' : '.');
        pdfFormatHint.classList.toggle('warn', tooSmall);
    }

    // What was actually generated (may be less than requested if the generator
    // gave up on a level), so the PDF never advertises grids it doesn't contain.
    function countByLevel(puzzles) {
        const counts = { easy: 0, medium: 0, hard: 0 };
        puzzles.forEach(p => counts[p.diffKey]++);
        return counts;
    }

    function batchDoneLabel(generated, requested) {
        return generated < requested
            ? `⚠ ${generated}/${requested} grilles générées et exportées`
            : `✓ ${generated} grilles vérifiées et exportées`;
    }

    function getBatchConfig() {
        const easy = Math.min(500, Math.max(0, parseInt(batchEasyInput.value) || 0));
        const medium = Math.min(500, Math.max(0, parseInt(batchMediumInput.value) || 0));
        const hard = Math.min(500, Math.max(0, parseInt(batchHardInput.value) || 0));
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

            if (puzzles.length === 0) { alert('Aucune grille n’a pu être générée.'); return; }
            const counts = countByLevel(puzzles);

            setProgress(0, 1, 'Construction du PDF...');
            await new Promise(r => setTimeout(r, 0));

            const fmt = getPdfFormat();
            const W = fmt.page.w, H = fmt.page.h;
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [W, H] });
            const date = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

            // The binding margin alternates sides with the page parity (see pdf-layout.js).
            let pageNum = 0;
            let margins;
            const contentW = () => W - margins.left - margins.right;
            const centerX = () => margins.left + contentW() / 2;
            const vk = H / 297; // cover / divider / certificate positions were designed on A4

            const beginPage = () => {
                if (pageNum > 0) pdf.addPage();
                pageNum++;
                margins = PdfLayout.pageMargins(pageNum, fmt.gutter, fmt.mirror);
                pdf.setFontSize(10);
                pdf.setTextColor(150, 150, 150);
                pdf.setFont('helvetica', 'normal');
                pdf.text(`Sudoku Perpignan - Page ${pageNum}`, centerX(), H - 8, { align: 'center' });
            };

            // Largest font size (up to `size`) at which every text fits in `maxW` mm.
            const fitSize = (texts, size, style, maxW = contentW()) => {
                pdf.setFont('helvetica', style);
                let s = size;
                pdf.setFontSize(s);
                while (s > 6 && Math.max(...texts.map(t => pdf.getTextWidth(t))) > maxW) {
                    s -= 0.5;
                    pdf.setFontSize(s);
                }
                return s;
            };

            // Text centred in the content area, shrunk if the page is narrow.
            const centered = (text, y, size, style, [r, g, b]) => {
                pdf.setTextColor(r, g, b);
                pdf.setFontSize(fitSize([text], size, style));
                pdf.text(text, centerX(), y, { align: 'center' });
            };

            // — Cover Page —
            beginPage();
            centered('Sudoku Perpignan', 80 * vk, 40, 'bold', [218, 18, 26]);
            centered('Livre de Puzzles', 100 * vk, 20, 'bold', [245, 124, 0]);
            centered(`Généré le ${date}`, 130 * vk, 14, 'normal', [80, 80, 80]);
            centered(`${puzzles.length} grilles au total :`, 150 * vk, 14, 'normal', [80, 80, 80]);
            let yOffset = 165 * vk;
            for (const [n, label] of [[counts.easy, 'Facile'], [counts.medium, 'Moyen'], [counts.hard, 'Difficile']]) {
                if (n > 0) { centered(`- ${n} ${label}`, yOffset, 14, 'bold', [80, 80, 80]); yOffset += 10 * vk; }
            }

            // Grids laid out 1, 2 or 4 per page, each with its title, inside the margins.
            const drawGridPages = (boards, perPage, titleFor, color) => {
                const titlePt = perPage === 4 ? 11 : 14;
                let slots;
                boards.forEach((board, i) => {
                    if (i % perPage === 0) {
                        beginPage();
                        slots = PdfLayout.gridSlots(W, H, margins, perPage);
                    }
                    const slot = slots[i % perPage];
                    const title = titleFor(i);
                    pdf.setTextColor(...color);
                    pdf.setFontSize(fitSize([title], titlePt, 'bold', slot.size));
                    pdf.text(title, slot.cx, slot.titleY, { align: 'center' });
                    drawGridOnPdf(pdf, board, slot.gridX, slot.gridY, slot.size / 9);
                });
            };

            // — Puzzle pages —
            drawGridPages(puzzles.map(p => p.puzzle), fmt.puzzlesPerPage,
                i => `#${i + 1} - ${puzzles[i].difficulty}`, [218, 18, 26]);

            // — Divider page for Solutions —
            beginPage();
            centered('Solutions', 140 * vk, 40, 'bold', [43, 130, 65]);

            // — Answer pages —
            drawGridPages(puzzles.map(p => p.solved), fmt.solutionsPerPage,
                i => `Solution #${i + 1} - ${puzzles[i].difficulty}`, [43, 130, 65]);

            // — Quality certificate on last page —
            beginPage();
            centered('Certificat de qualité', 40 * vk, 18, 'bold', [218, 18, 26]);
            const lines = [
                `Lot généré le ${date}`,
                `${puzzles.length} grilles - ${counts.easy} Facile - ${counts.medium} Moyen - ${counts.hard} Difficile`,
                '',
                '-  Chaque grille possède exactement une solution unique',
                '-  Grilles Facile : Niveau débutant, remplissage par logique simple',
                '-  Grilles Moyen : Niveau intermédiaire, analyse logique plus poussée',
                '-  Grilles Difficile : Niveau expert, au-delà des techniques de base',
                '-  Toutes les solutions sont vérifiées informatiquement',
                '-  Aucune grille en double dans ce lot',
                '',
                'Généré par Sudoku Perpignan Generator'
            ];
            pdf.setFontSize(fitSize(lines, 12, 'normal'));
            pdf.setTextColor(40, 40, 40);
            lines.forEach((line, idx) => {
                pdf.text(line, centerX(), (60 + idx * 10) * vk, { align: 'center' });
            });

            pdf.save(`Sudoku_Perpignan_Lot_${puzzles.length}.pdf`);
            setProgress(puzzles.length, puzzles.length, batchDoneLabel(puzzles.length, cfg.total));

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

            if (puzzles.length === 0) { alert('Aucune grille n’a pu être générée.'); return; }

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
            setProgress(puzzles.length, puzzles.length, batchDoneLabel(puzzles.length, cfg.total));

        } catch (err) {
            console.error(err);
            alert("Erreur lors de la création du ZIP.");
        } finally {
            setBatchBusy(false);
        }
    }
});
