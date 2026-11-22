import { describe, it } from 'node:test';
import assert from 'node:assert';
import { resolvePhotoUrls } from '../../shared/utils/photos.js';

describe('Previous Works Photo Resolution & Branch Matching Tests', () => {
  it('1. Resolves 3 photos with cover photo ordered first', async () => {
    const rawPhotos = [
      { id: 'p1', url: 'https://example.com/photo1.jpg', caption: 'Stage view', isCover: false },
      { id: 'p2', url: 'https://example.com/photo2.jpg', caption: 'Grand entrance', isCover: true },
      { id: 'p3', url: 'https://example.com/photo3.jpg', caption: 'Dining hall', isCover: false }
    ];

    const resolved = await resolvePhotoUrls(rawPhotos);
    assert.strictEqual(resolved.length, 3);

    // Simulate ordering logic in VendorDetailPage
    const valid = resolved.filter(p => p && Boolean(p.url));
    const coverIdx = valid.findIndex(p => p.isCover);
    let sorted = valid;
    if (coverIdx > 0) {
      const [cover] = valid.splice(coverIdx, 1);
      sorted = [cover, ...valid];
    }

    assert.strictEqual(sorted[0].id, 'p2');
    assert.strictEqual(sorted[0].isCover, true);
    assert.strictEqual(sorted[0].caption, 'Grand entrance');
    assert.strictEqual(sorted[1].id, 'p1');
    assert.strictEqual(sorted[2].id, 'p3');
  });

  it('2. Handles work with 0 photos: empty array and null coverPhotoUrl', async () => {
    const work = {
      id: 'work_empty',
      title: 'Corporate Meet',
      eventType: 'Corporate',
      date: '2025-05-10',
      guests: 200,
      photos: []
    };

    const resolved = await resolvePhotoUrls(work.photos);
    assert.strictEqual(resolved.length, 0);

    const coverPhotoUrl = resolved[0]?.url || null;
    assert.strictEqual(coverPhotoUrl, null);
    // Render condition: if (!photos || photos.length === 0) -> text-only card
    assert.strictEqual(resolved.length === 0, true);
  });

  it('3. Matches works to specific branches and supports legacy works', () => {
    const hallBranch = { id: 'branch_hall_1', type: 'hall' };
    const cateringBranch = { id: 'branch_catering_1', type: 'caterer' };

    const works = [
      { id: 'w1', title: 'Grand Wedding at Hall', branchId: 'branch_hall_1' },
      { id: 'w2', title: 'Banquet Feast', branchId: 'branch_catering_1' },
      { id: 'w3', title: 'Legacy Celebration', branchId: null } // Legacy work without branchId
    ];

    // Hall branch filter
    const hallWorks = works.filter(w => !w.branchId || w.branchId === hallBranch.id);
    assert.strictEqual(hallWorks.length, 2);
    assert.ok(hallWorks.some(w => w.id === 'w1'));
    assert.ok(hallWorks.some(w => w.id === 'w3'));
    assert.ok(!hallWorks.some(w => w.id === 'w2'));

    // Catering branch filter
    const cateringWorks = works.filter(w => !w.branchId || w.branchId === cateringBranch.id);
    assert.strictEqual(cateringWorks.length, 2);
    assert.ok(cateringWorks.some(w => w.id === 'w2'));
    assert.ok(cateringWorks.some(w => w.id === 'w3'));
    assert.ok(!cateringWorks.some(w => w.id === 'w1'));
  });
});
