$ErrorActionPreference = 'Stop'

$cdp = 'C:\Users\fiver\AppData\Local\codex-skills\chrome-cdp\scripts\cdp.mjs'
$target = 'BF741DAC'

function Invoke-Cdp {
  param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$ArgsList
  )

  & node.exe $cdp @ArgsList
}

$navigateExtensions = @{ url = 'chrome://extensions/' } | ConvertTo-Json -Compress
Invoke-Cdp evalraw $target 'Page.navigate' $navigateExtensions | Write-Output
Start-Sleep -Milliseconds 1200

$reloadExpr = @"
(() => {
  const manager = document.querySelector('extensions-manager');
  if (!manager) return { ok: false, stage: 'no-manager', title: document.title };

  const list = manager.shadowRoot?.querySelector('extensions-item-list');
  if (!list) return { ok: false, stage: 'no-item-list' };

  const items = [...(list.shadowRoot?.querySelectorAll('extensions-item') || [])];
  const names = items
    .map(item => item.shadowRoot?.querySelector('#name')?.textContent?.trim())
    .filter(Boolean);

  const item = items.find(candidate => (
    candidate.shadowRoot?.querySelector('#name')?.textContent || ''
  ).includes('太空饭否'));
  if (!item) return { ok: false, stage: 'not-found', names };

  const root = item.shadowRoot;
  const reloadButton = root.querySelector('#dev-reload-button')
    || root.querySelector('cr-icon-button#dev-reload-button')
    || [...root.querySelectorAll('button, cr-button, cr-icon-button')]
      .find(button => {
        const label = [
          button.id,
          button.textContent,
          button.getAttribute('aria-label'),
          button.getAttribute('title'),
        ].filter(Boolean).join(' ');
        return /刷新|reload/i.test(label);
      });

  if (!reloadButton) {
    return {
      ok: false,
      stage: 'no-reload-button',
      names,
      buttons: [...root.querySelectorAll('button, cr-button, cr-icon-button')].map(button => ({
        id: button.id || '',
        text: (button.textContent || '').trim(),
        ariaLabel: button.getAttribute('aria-label') || '',
        title: button.getAttribute('title') || '',
      })),
    };
  }

  reloadButton.click();
  return {
    ok: true,
    stage: 'reloaded',
    name: root.querySelector('#name')?.textContent?.trim() || '',
  };
})()
"@

$reloadParams = @{
  expression = $reloadExpr
  awaitPromise = $true
  returnByValue = $true
} | ConvertTo-Json -Compress -Depth 8

Invoke-Cdp evalraw $target 'Runtime.evaluate' $reloadParams | Write-Output
Start-Sleep -Milliseconds 1200

$navigateFanfou = @{ url = 'https://fanfou.com/home' } | ConvertTo-Json -Compress
Invoke-Cdp evalraw $target 'Page.navigate' $navigateFanfou | Write-Output
