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
    const SAFE_MARGIN = 9.5;  // 0.375 in — nothing (text or graphics) may come closer to the outer, top or bottom edge
    const OUTER = 12.7;       // outer (non-binding) side margin
    const TOP = 15;
    const BOTTOM = 18;        // leaves room for the page-number footer
    const GAP = 6;            // space between two grids on the same page
    const MIN_LEGIBLE_CELL = 6; // below this the letters get hard to read on paper

    // Line weights are specified in points (as print specs are) and converted to mm.
    const PT_TO_MM = 25.4 / 72;
    const INNER_LINE_PT = 0.5;   // thin lines between cells
    const THICK_LINE_PT = 1.75;  // 3x3 block lines and outer frame (spec: 1.5 to 2 pt)
    const GRID_LINE = THICK_LINE_PT * PT_TO_MM; // frame thickness in mm, centred on the grid edge

    // Page-number footer: 10 pt text whose baseline sits 11 mm above the bottom edge.
    // Descenders reach about 0.8 mm below the baseline, so the ink stays above SAFE_MARGIN.
    const FOOTER_BASELINE = 11;
    const FOOTER_INK_BOTTOM = FOOTER_BASELINE - 0.8;
    const footerY = pageH => pageH - FOOTER_BASELINE;

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

    // Positions of `perPage` (1, 2, 4 or 6) titled grids inside the page margins:
    // 1 → 1×1 (grid centred on the page), 2 → 1×2, 4 → 2×2, 6 → 2×3.
    // Each entry: { cx, titleY, gridX, gridY, size } — `size` is the side of the grid
    // in mm, so a cell is size / 9. The grid's outer ink edge (frame included) never
    // crosses the margins.
    function gridSlots(pageW, pageH, margins, perPage) {
        const cols = perPage >= 4 ? 2 : 1;
        const rows = perPage === 1 ? 1 : perPage === 6 ? 3 : 2;
        const titleH = perPage >= 4 ? 9 : 12;
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
                // Several grids: title + grid are centred as one block in their slot.
                // A single grid is centred itself, the title using the space above it
                // (unless the page is so short that the title needs that space).
                const blockGridY = slotY + (slotH - (titleH + size)) / 2 + titleH;
                const gridY = perPage === 1
                    ? Math.max(slotY + (slotH - size) / 2, slotY + titleH)
                    : blockGridY;
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
        PAGE_SIZES, MIN_GUTTER, MAX_GUTTER, SAFE_MARGIN, MIN_LEGIBLE_CELL,
        PT_TO_MM, INNER_LINE_PT, THICK_LINE_PT, GRID_LINE, FOOTER_INK_BOTTOM,
        clampGutter, pageMargins, gridSlots, cellSize, footerY
    };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = PdfLayout;
