// Page geometry for the batch PDF. Pure functions (no DOM, no jsPDF) so the margin
// guarantees can be unit-tested. All lengths are in millimetres.
const PdfLayout = (() => {
    const PAGE_SIZES = {
        a4:     { w: 210,   h: 297 },
        a5:     { w: 148,   h: 210 },
        letter: { w: 215.9, h: 279.4 }, // 8.5 × 11 in
        '6x9':  { w: 152.4, h: 228.6 }, // 6 × 9 in
        '8x10': { w: 203.2, h: 254 }    // 8 × 10 in
    };

    const MIN_GUTTER = 12.7;  // 0.5 in — smallest allowed binding (inner) margin
    const MAX_GUTTER = 30;
    const OUTER = 12.7;       // outer (non-binding) side margin
    const TOP = 15;
    const BOTTOM = 18;        // leaves room for the page-number footer
    const GAP = 6;            // space between two grids on the same page
    const GRID_LINE = 1.1;    // thickness of the red frame, centred on the grid edge
    const MIN_LEGIBLE_CELL = 6; // below this the letters get hard to read on paper

    // Keep the binding margin at or above the minimum, whatever was typed.
    function clampGutter(value) {
        const v = Number(value);
        if (!Number.isFinite(v)) return MIN_GUTTER;
        return Math.min(MAX_GUTTER, Math.max(MIN_GUTTER, Math.round(v * 10) / 10));
    }

    // Margins of one page. Page 1 is a right-hand (recto) page, so its binding edge is
    // on the left; even pages are left-hand pages with the binding edge on the right.
    // With `mirror` off (single-sided print, ring binder) the binding edge is always left.
    function pageMargins(pageNumber, gutter, mirror) {
        const bindingLeft = !mirror || pageNumber % 2 === 1;
        return {
            left: bindingLeft ? gutter : OUTER,
            right: bindingLeft ? OUTER : gutter,
            top: TOP,
            bottom: BOTTOM
        };
    }

    // Positions of `perPage` (1, 2 or 4) titled grids inside the page margins.
    // Each entry: { cx, titleY, gridX, gridY, size } — `size` is the side of the grid
    // in mm, so a cell is size / 9. The grid's outer ink edge (frame included) never
    // crosses the margins.
    function gridSlots(pageW, pageH, margins, perPage) {
        const cols = perPage === 4 ? 2 : 1;
        const rows = perPage === 1 ? 1 : 2;
        const titleH = perPage === 4 ? 9 : 12;
        const areaW = pageW - margins.left - margins.right;
        const areaH = pageH - margins.top - margins.bottom;
        const slotW = (areaW - GAP * (cols - 1)) / cols;
        const slotH = (areaH - GAP * (rows - 1)) / rows;
        const size = Math.floor(Math.min(slotW - GRID_LINE, slotH - titleH - GRID_LINE) * 10) / 10;

        const slots = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const slotX = margins.left + c * (slotW + GAP);
                const slotY = margins.top + r * (slotH + GAP);
                const blockY = slotY + (slotH - (titleH + size)) / 2;
                const gridY = blockY + titleH;
                slots.push({
                    cx: slotX + slotW / 2,
                    titleY: gridY - titleH * 0.42,
                    gridX: slotX + (slotW - size) / 2,
                    gridY,
                    size
                });
            }
        }
        return slots;
    }

    // Side of one cell, in mm, for a given layout. Identical on every page (the binding
    // and outer margins just swap sides), so page 1 is enough to measure it.
    function cellSize(pageW, pageH, gutter, perPage) {
        return gridSlots(pageW, pageH, pageMargins(1, gutter, false), perPage)[0].size / 9;
    }

    return {
        PAGE_SIZES, MIN_GUTTER, MAX_GUTTER, GRID_LINE, MIN_LEGIBLE_CELL,
        clampGutter, pageMargins, gridSlots, cellSize
    };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = PdfLayout;
