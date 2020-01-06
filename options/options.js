/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * Portions Copyright (C) Philipp Kewisch, 2019 */

(async function() {
  let prefs = await browser.storage.local.get({
    colorOf: "calendar",
    useBackground: false
  });

  document.getElementById("useBackground").checked = prefs.useBackground;
  document.getElementById("colorOf-" + prefs.colorOf).checked = true;

  for (let node of document.querySelectorAll("[data-l10n-id]")) {
    let l10nid = node.getAttribute("data-l10n-id");
    node.textContent = browser.i18n.getMessage(l10nid);
  }

  document.body.addEventListener("change", () => {
    browser.storage.local.set({
      colorOf: document.querySelector("input[name='colorOf']:checked").value,
      useBackground: document.getElementById("useBackground").checked
    });
  });
})();
