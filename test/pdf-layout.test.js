const test = require('node:test');
const assert = require('node:assert/strict');
const PdfLayout = require('../pdf-layout.js');

const EPS = 1e-6;
const SIZES = Object.keys(PdfLayout.PAGE_SIZES);
const PER_PAGE = [1, 2, 4];

test('the binding margin can never go below 12.7 mm', () => {
    assert.equal(PdfLayout.clampGutter(12.7), 12.7);
    assert.equal(PdfLayout.clampGutter(5), 12.7);
    assert.equal(PdfLayout.clampGutter(0), 12.7);
    assert.equal(PdfLayout.clampGutter(-3), 12.7);
    assert.equal(PdfLayout.clampGutter(''), 12.7);
    assert.equal(PdfLayout.clampGutter('abc'), 12.7);
    assert.equal(PdfLayout.clampGutter(undefined), 12.7);
    assert.equal(PdfLayout.clampGutter(20), 20);
    assert.equal(PdfLayout.clampGutter(999), PdfLayout.MAX_GUTTER);
});

test('the binding side alternates with mirror margins, page 1 being a right-hand page', () => {
    const g = 15;
    const p1 = PdfLayout.pageMargins(1, g, true);
    const p2 = PdfLayout.pageMargins(2, g, true);
    const p3 = PdfLayout.pageMargins(3, g, true);
    assert.equal(p1.left, g); assert.ok(p1.right < g);
    assert.equal(p2.right, g); assert.ok(p2.left < g);
    assert.deepEqual(p3, p1);
});

test('without mirror margins the binding side is always the left', () => {
    for (let page = 1; page <= 6; page++) {
        const m = PdfLayout.pageMargins(page, 15, false);
        assert.equal(m.left, 15);
        assert.ok(m.right < 15);
    }
});

for (const size of SIZES) {
    for (const perPage of PER_PAGE) {
        for (const mirror of [true, false]) {
            for (const gutter of [12.7, 20, 30]) {
                test(`${size}, ${perPage}/page, mirror=${mirror}, gutter=${gutter}: grids stay inside the margins`, () => {
                    const { w, h } = PdfLayout.PAGE_SIZES[size];
                    for (let page = 1; page <= 4; page++) {
                        const m = PdfLayout.pageMargins(page, gutter, mirror);
                        const slots = PdfLayout.gridSlots(w, h, m, perPage);
                        assert.equal(slots.length, perPage);

                        const half = PdfLayout.GRID_LINE / 2;
                        for (const s of slots) {
                            assert.ok(s.size > 0, 'grid has a positive size');
                            assert.ok(Math.abs(s.size / 9 - PdfLayout.cellSize(w, h, gutter, perPage)) < EPS,
                                'cellSize() agrees with gridSlots()');
                            // ink edges of the frame (the 1.1 mm line is centred on the grid edge)
                            assert.ok(s.gridX - half >= m.left - EPS, 'left ink edge inside margin');
                            assert.ok(s.gridX + s.size + half <= w - m.right + EPS, 'right ink edge inside margin');
                            assert.ok(s.gridY + s.size + half <= h - m.bottom + EPS, 'bottom ink edge inside margin');
                            assert.ok(s.titleY > m.top, 'title below the top margin');
                        }

                        // The inner (binding) side always keeps at least 12.7 mm of blank paper.
                        const bindingLeft = !mirror || page % 2 === 1;
                        for (const s of slots) {
                            const innerBlank = bindingLeft
                                ? s.gridX - half
                                : w - (s.gridX + s.size + half);
                            assert.ok(innerBlank >= 12.7 - EPS, `inner margin ${innerBlank.toFixed(2)} mm < 12.7 mm`);
                        }

                        // No two grids (with their titles) overlap.
                        for (let a = 0; a < slots.length; a++) {
                            for (let b = a + 1; b < slots.length; b++) {
                                const A = slots[a], B = slots[b];
                                const apart = A.gridX + A.size <= B.gridX || B.gridX + B.size <= A.gridX
                                    || A.gridY + A.size <= B.titleY || B.gridY + B.size <= A.titleY;
                                assert.ok(apart, 'grids overlap');
                            }
                        }
                    }
                });
            }
        }
    }
}

test('with the minimum binding margin every page size and layout stays legible', () => {
    for (const size of SIZES) {
        const { w, h } = PdfLayout.PAGE_SIZES[size];
        for (const perPage of PER_PAGE) {
            const cell = PdfLayout.cellSize(w, h, PdfLayout.MIN_GUTTER, perPage);
            assert.ok(cell >= PdfLayout.MIN_LEGIBLE_CELL, `${size}, ${perPage}/page: cells are ${cell.toFixed(1)} mm`);
        }
    }
});

test('one grid per page on A4 is large and centred in the content area', () => {
    const { w, h } = PdfLayout.PAGE_SIZES.a4;
    const m = PdfLayout.pageMargins(1, 12.7, true);
    const [s] = PdfLayout.gridSlots(w, h, m, 1);
    assert.ok(s.size > 175, `grid is ${s.size} mm`);
    assert.ok(Math.abs(s.cx - (m.left + (w - m.left - m.right) / 2)) < EPS);
});
