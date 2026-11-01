import { test } from 'node:test';
import assert from 'node:assert/strict';
// Browser-native module: these helpers do not access the DOM on import.
// @ts-ignore no declaration needed for browser JS
import { firstClimber, guideStep } from '../public/expedition-onboarding.js';

test('first climb never resets live play or rescue practice, and skips busy/resting viewers', () => {
    const state = { id: 'demo', mode: 'demo', players: [{ id: 'busy' }, { id: 'queued' }, { id: 'resting', digReadyAt: 200 }, { id: 'ready' }], runs: [{ playerId: 'busy' }], queue: [{ playerId: 'queued' }] };
    assert.equal(firstClimber(state, 100).id, 'ready');
    assert.equal(firstClimber({ ...state, mode: 'live' }, 100), null);
    assert.equal(firstClimber({ ...state, practice: {} }, 100), null);
});

test('saved guide resumes the held choice, then expires on session reset', () => {
    const guide = { sessionId: 'demo', playerId: 'p', runId: 'r' };
    const state = { id: 'demo', mode: 'demo', players: [{ id: 'p', name: 'Noodle' }], runs: [{ id: 'r', playerId: 'p', phase: 'choice' }], queue: [] };
    assert.equal(guideStep(state, guide).step, '2 / YOUR CHOICE');
    assert.equal(guideStep({ ...state, id: 'reset' }, guide), null);
    assert.equal(guideStep({ ...state, runs: [] }, guide).step, '3 / DONE');
    assert.equal(guideStep({ ...state, runs: [{ id: 'another', playerId: 'p', phase: 'choice' }] }, guide).step, '3 / DONE');
});
