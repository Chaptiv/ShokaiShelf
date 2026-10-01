import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardDream from './Dashboard_dream';
import { viewerCached, userLists } from '../api/anilist';
import { getDreamEngine } from '../logic/netrecDream';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../api/anilist', () => ({
  viewerCached: vi.fn(), userLists: vi.fn(), saveEntry: vi.fn(),
  mediaDetails: vi.fn(), deleteEntry: vi.fn(),
}));
vi.mock('../logic/netrecDream', () => ({
  getDreamEngine: vi.fn(), createDreamEngine: vi.fn(),
}));
vi.mock('../logic/feedback-store', () => ({
  getLikedMediaIds: async () => [], getDislikedMediaIds: async () => [],
  saveFeedback: vi.fn(),
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

async function mount() {
  const onLoadingChange = vi.fn();
  await act(async () => { render(<DashboardDream onLoadingChange={onLoadingChange} />); });
  return onLoadingChange;
}

describe('Dream dashboard startup', () => {
  it('releases the boot overlay when the viewer request fails', async () => {
    vi.mocked(viewerCached).mockRejectedValue(new Error('Network unavailable'));
    const loading = await mount();
    expect(screen.getByText('Network unavailable')).toBeInTheDocument();
    expect(loading).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole('button', { name: 'common.retry' })).toBeInTheDocument();
  });

  it('shows an actionable error when the viewer is missing', async () => {
    vi.mocked(viewerCached).mockResolvedValue(null);
    const loading = await mount();
    expect(screen.getByText('dashboard.viewerUnavailable')).toBeInTheDocument();
    expect(loading).toHaveBeenLastCalledWith(false);
  });

  it('releases the overlay when the viewer request never settles', async () => {
    vi.mocked(viewerCached).mockReturnValue(new Promise(() => {}));
    const loading = await mount();
    expect(loading).toHaveBeenLastCalledWith(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
    expect(screen.getByText('dashboard.loadTimeout')).toBeInTheDocument();
    expect(loading).toHaveBeenLastCalledWith(false);
  });

  it('does not resume loading if the viewer arrives after the timeout', async () => {
    let resolveViewer!: (value: any) => void;
    vi.mocked(viewerCached).mockReturnValue(new Promise(resolve => { resolveViewer = resolve; }));
    await mount();
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
    await act(async () => { resolveViewer({ id: 1, name: 'test' }); });
    expect(screen.getByText('dashboard.loadTimeout')).toBeInTheDocument();
    expect(getDreamEngine).not.toHaveBeenCalled();
  });

  it('bounds the recommendation pipeline as well as the viewer request', async () => {
    vi.mocked(viewerCached).mockResolvedValue({ id: 1, name: 'test' });
    vi.mocked(getDreamEngine).mockReturnValue({ recommend: () => new Promise(() => {}) } as any);
    vi.mocked(userLists).mockResolvedValue({ lists: [] });
    const loading = await mount();
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
    expect(screen.getByText('dashboard.loadTimeout')).toBeInTheDocument();
    expect(loading).toHaveBeenLastCalledWith(false);
  });

  it('handles unavailable session storage without leaving the boot overlay up', async () => {
    vi.mocked(viewerCached).mockResolvedValue({ id: 1, name: 'test' });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage unavailable'); });
    const loading = await mount();
    expect(screen.getByText('Storage unavailable')).toBeInTheDocument();
    expect(loading).toHaveBeenLastCalledWith(false);
  });
});
