import { expect, type Page } from '@playwright/test';

/**
 * The future-software panel's tab handlers (click + keydown) are wired by an
 * `afterInteractive` script, so an interaction can land before the handler
 * binds. Retry the given action until the expected tab reports selected.
 *
 * Usage: pass an action that performs the interaction (click, keypress) and the
 * index of the tab that should become selected as a result.
 */
export async function retryUntilTabSelected(
  page: Page,
  action: () => Promise<void>,
  expectedIndex: number,
): Promise<void> {
  const tab = page.getByRole('tab').nth(expectedIndex);
  await expect(async () => {
    await action();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
  }).toPass();
}
